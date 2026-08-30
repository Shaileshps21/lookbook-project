import { Queue, Worker, type Job } from "bullmq";
import { Order } from "../models/Order";
import { Book } from "../models/Book";
import { User } from "../models/User";
import { sendMail } from "../utils/mailer";
import { notify } from "../utils/notify";
import { calculateLateFee } from "../utils/lateFee";
import { createQueueConnection, createWorkerConnection, queuesEnabled, attachQueueErrorHandler } from "./connection";

const QUEUE_NAME = "rental-due-reminders";
const REPEAT_EVERY_MS = 6 * 60 * 60 * 1000; // every 6 hours
const REMIND_WINDOW_HOURS = 24;
// Sweeping sends one SMTP email per due rental — give it headroom so the
// lock (renewed at half this value) never expires mid-run.
const LOCK_DURATION_MS = 5 * 60 * 1000;

export const rentalReminderQueue = queuesEnabled
  ? new Queue(QUEUE_NAME, { connection: createQueueConnection() })
  : null;

if (rentalReminderQueue) attachQueueErrorHandler(rentalReminderQueue, "rental-reminder");

/** Finds active rentals due within the next 24h that haven't been reminded yet, and emails the renter. */
const runReminderSweep = async (): Promise<void> => {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMIND_WINDOW_HOURS * 60 * 60 * 1000);

  const orders = await Order.find({
    status: { $in: ["Active", "Delivered"] },
    "items.mode": "rent",
    "items.dueDate": { $gte: now, $lte: windowEnd },
    "items.reminderSentAt": null,
  });

  for (const order of orders) {
    const user = await User.findById(order.user).select("name email emailPreferences");
    if (!user) continue;
    const emailAllowed = user.emailPreferences?.rentalReminders !== false;

    let touched = false;
    for (const item of order.items) {
      if (item.mode !== "rent" || !item.dueDate || item.reminderSentAt) continue;
      if (item.dueDate < now || item.dueDate > windowEnd) continue;

      const book = await Book.findById(item.book).select("title");
      if (emailAllowed) {
        await sendMail({
          to: user.email,
          subject: `Reminder: "${book?.title ?? "Your rental"}" is due soon`,
          html: `<p>Hi ${user.name},</p><p>Your rental of <strong>${book?.title ?? "a book"}</strong> is due on ${item.dueDate.toDateString()}. Please return or extend it to avoid a late fee.</p>`,
        });
      }
      notify(
        order.user.toString(),
        "rental.due",
        "Rental due soon",
        `"${book?.title ?? "Your rental"}" is due on ${item.dueDate.toDateString()}.`,
        "/profile"
      );
      item.reminderSentAt = now;
      touched = true;
    }
    if (touched) await order.save();
  }
};

/**
 * Accrues late fees on rentals that are past due and not yet returned, so an
 * overdue fee is visible to the renter as it grows rather than only appearing
 * at return time. Recomputed (not incremented) from the due date each run, so
 * a missed or repeated sweep can never double-charge. Returned items are
 * excluded — their fee was finalized at return.
 */
const runLateFeeSweep = async (): Promise<void> => {
  const now = new Date();

  const orders = await Order.find({
    status: { $in: ["Active", "Delivered"] },
    items: { $elemMatch: { mode: "rent", returnedAt: null, dueDate: { $lt: now } } },
  });

  for (const order of orders) {
    let touched = false;
    for (const item of order.items) {
      if (item.mode !== "rent" || item.returnedAt || !item.dueDate) continue;
      const fee = calculateLateFee(item, now);
      if (fee !== (item.lateFee ?? 0)) {
        item.lateFee = fee;
        touched = true;
      }
    }
    if (touched) await order.save();
  }
};

export const startRentalReminderWorker = (): void => {
  if (!queuesEnabled || !rentalReminderQueue) return;

  const worker = new Worker(
    QUEUE_NAME,
    async (_job: Job) => {
      await runReminderSweep();
      await runLateFeeSweep();
    },
    { connection: createWorkerConnection(), lockDuration: LOCK_DURATION_MS }
  );
  attachQueueErrorHandler(worker, "rental-reminder");

  rentalReminderQueue
    .add(
      "sweep",
      {},
      {
        repeat: { every: REPEAT_EVERY_MS },
        jobId: "rental-due-reminders-repeat",
      }
    )
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.warn("[queues] Failed to schedule rental reminder sweep:", err);
    });
};
