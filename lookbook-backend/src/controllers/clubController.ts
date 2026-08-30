import crypto from "crypto";
import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { Club } from "../models/Club";
import { Thread } from "../models/Thread";
import { Comment } from "../models/Comment";
import { env } from "../config/env";

const isOwnerOrAdmin = (club: InstanceType<typeof Club>, userId: string, role?: string) =>
  club.owner.toString() === userId || role === "admin";

/** Builds the shareable invite URL off the server-configured CLIENT_URL —
 * never the requesting browser's own origin — so the link is always the
 * real deployed frontend domain (matches every other link this app emails
 * out, e.g. verify-email/reset-password) rather than whatever host happened
 * to serve a given request. */
const inviteUrlFor = (token: string) => `${env.clientUrl}/clubs/join/${token}`;

/** Attaches the computed inviteUrl onto a club's JSON representation. Every
 * response that hands a club back to the frontend goes through this so the
 * frontend never has to (and can't accidentally use window.location to)
 * build the link itself. */
const withInviteUrl = (club: InstanceType<typeof Club>) => ({
  ...club.toJSON(),
  inviteUrl: inviteUrlFor(club.inviteToken),
});

/** Backfills an invite token for a club that predates this feature — the
 * schema default only fires on document creation, so a club loaded from
 * before this migration would otherwise generate a fresh (unpersisted)
 * token on every read and never actually be findable by it. Self-heals on
 * first read; a no-op once every club has a real stored token. */
const ensureInviteToken = async (club: InstanceType<typeof Club>): Promise<void> => {
  if (club.inviteToken) return;
  club.inviteToken = crypto.randomBytes(16).toString("hex");
  await club.save();
};

/**
 * Every club response must carry the same populated shape the detail view
 * fetches, or the UI re-renders with bare ObjectIds — joining a club made
 * "owned by UI Test User" render as "owned by " because the mutation
 * returned an unpopulated document. (Same defect class already fixed for
 * order mutations.)
 */
const populateClub = (club: InstanceType<typeof Club>) =>
  club.populate([
    { path: "book", select: "title image author" },
    { path: "owner", select: "name avatar" },
    { path: "members", select: "name avatar" },
  ]);

export const getClubs = asyncHandler(async (_req: Request, res: Response) => {
  const clubs = await Club.find().populate("book", "title image").populate("owner", "name avatar").sort("-createdAt");
  await Promise.all(clubs.map(ensureInviteToken));
  return ApiResponse.ok(res, clubs.map(withInviteUrl));
});

export const getClubById = asyncHandler(async (req: Request, res: Response) => {
  const club = await Club.findById(req.params.id)
    .populate("book", "title image author")
    .populate("owner", "name avatar")
    .populate("members", "name avatar");
  if (!club) throw ApiError.notFound("Club not found");
  await ensureInviteToken(club);
  return ApiResponse.ok(res, withInviteUrl(club));
});

export const createClub = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const { name, description, bookId } = req.body as { name: string; description?: string; bookId?: string };
  if (!name?.trim()) throw ApiError.badRequest("Club name is required.");

  const club = await Club.create({
    name: name.trim(),
    description: description?.trim() ?? "",
    book: bookId || undefined,
    owner: req.user.id,
    members: [req.user.id],
  });

  await populateClub(club);
  return ApiResponse.created(res, withInviteUrl(club), "Club created");
});

export const joinClub = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const club = await Club.findById(req.params.id);
  if (!club) throw ApiError.notFound("Club not found");

  if (!club.members.some((m) => m.toString() === req.user!.id)) {
    club.members.push(req.user.id as never);
    await club.save();
  }

  await populateClub(club);
  return ApiResponse.ok(res, withInviteUrl(club), "Joined club");
});

export const updateClub = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const club = await Club.findById(req.params.id);
  if (!club) throw ApiError.notFound("Club not found");
  if (!isOwnerOrAdmin(club, req.user.id, req.user.role)) {
    throw ApiError.forbidden("Only the club owner can edit this club.");
  }

  const { name, description } = req.body as { name?: string; description?: string };
  if (name?.trim()) club.name = name.trim();
  if (description !== undefined) club.description = description.trim();
  await club.save();

  await populateClub(club);
  return ApiResponse.ok(res, withInviteUrl(club), "Club updated");
});

export const removeMember = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const club = await Club.findById(req.params.id);
  if (!club) throw ApiError.notFound("Club not found");
  if (!isOwnerOrAdmin(club, req.user.id, req.user.role)) {
    throw ApiError.forbidden("Only the club owner can remove members.");
  }

  const { memberId } = req.params;
  if (memberId === club.owner.toString()) {
    throw ApiError.badRequest("The club owner can't be removed.");
  }

  club.members = club.members.filter((m) => m.toString() !== memberId) as typeof club.members;
  await club.save();
  await populateClub(club);

  return ApiResponse.ok(res, withInviteUrl(club), "Member removed");
});

export const leaveClub = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const club = await Club.findById(req.params.id);
  if (!club) throw ApiError.notFound("Club not found");
  if (club.owner.toString() === req.user.id) {
    throw ApiError.badRequest("The club owner can't leave — delete the club instead.");
  }

  club.members = club.members.filter((m) => m.toString() !== req.user!.id) as typeof club.members;
  await club.save();

  await populateClub(club);
  return ApiResponse.ok(res, withInviteUrl(club), "Left club");
});

export const deleteClub = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const club = await Club.findById(req.params.id);
  if (!club) throw ApiError.notFound("Club not found");
  if (!isOwnerOrAdmin(club, req.user.id, req.user.role)) {
    throw ApiError.forbidden("Only the club owner can delete this club.");
  }

  const threads = await Thread.find({ club: club.id }).select("_id");
  await Comment.deleteMany({ thread: { $in: threads.map((t) => t.id) } });
  await Thread.deleteMany({ club: club.id });
  await club.deleteOne();

  return ApiResponse.ok(res, null, "Club deleted");
});

/** Public preview for the invite-join page — no auth required, just enough
 * to render the "Join [Club Name]" card. */
export const getClubByInvite = asyncHandler(async (req: Request, res: Response) => {
  const club = await Club.findOne({ inviteToken: req.params.token, inviteEnabled: true })
    .populate("book", "title image author")
    .populate("owner", "name");
  if (!club) throw ApiError.notFound("This invite link is invalid or has been disabled.");

  const owner = club.owner as unknown as { name: string } | null;
  return ApiResponse.ok(res, {
    id: club.id,
    name: club.name,
    description: club.description,
    memberCount: club.members.length,
    book: club.book,
    owner: { name: owner?.name ?? "Unknown" },
  });
});

export const joinByInvite = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const club = await Club.findOne({ inviteToken: req.params.token, inviteEnabled: true });
  if (!club) throw ApiError.notFound("This invite link is invalid or has been disabled.");

  if (club.members.some((m) => m.toString() === req.user!.id)) {
    await populateClub(club);
    return ApiResponse.ok(res, { alreadyMember: true, club: withInviteUrl(club) }, "Already a member");
  }

  club.members.push(req.user.id as never);
  await club.save();
  await populateClub(club);

  return ApiResponse.ok(res, { alreadyMember: false, club: withInviteUrl(club) }, "Joined club");
});

export const regenerateInvite = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const club = await Club.findById(req.params.id);
  if (!club) throw ApiError.notFound("Club not found");
  if (!isOwnerOrAdmin(club, req.user.id, req.user.role)) {
    throw ApiError.forbidden("Only the club owner can regenerate the invite link.");
  }

  club.inviteToken = crypto.randomBytes(16).toString("hex");
  await club.save();

  return ApiResponse.ok(
    res,
    { inviteToken: club.inviteToken, inviteUrl: inviteUrlFor(club.inviteToken) },
    "Invite link regenerated"
  );
});

export const toggleInvite = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const club = await Club.findById(req.params.id);
  if (!club) throw ApiError.notFound("Club not found");
  if (!isOwnerOrAdmin(club, req.user.id, req.user.role)) {
    throw ApiError.forbidden("Only the club owner can change the invite link.");
  }

  const { enabled } = req.body as { enabled?: boolean };
  club.inviteEnabled = Boolean(enabled);
  await club.save();

  return ApiResponse.ok(res, { inviteEnabled: club.inviteEnabled }, "Invite link updated");
});
