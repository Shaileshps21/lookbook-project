import { createReviewSchema } from "../validators/reviewValidators";

describe("createReviewSchema", () => {
  it("accepts a valid review", () => {
    const result = createReviewSchema.safeParse({ rating: 5, comment: "Loved this book!" });
    expect(result.success).toBe(true);
  });

  it("rejects a rating outside 1-5", () => {
    expect(createReviewSchema.safeParse({ rating: 6, comment: "Great book indeed" }).success).toBe(false);
    expect(createReviewSchema.safeParse({ rating: 0, comment: "Great book indeed" }).success).toBe(false);
  });

  it("rejects a comment shorter than 3 characters", () => {
    const result = createReviewSchema.safeParse({ rating: 4, comment: "ok" });
    expect(result.success).toBe(false);
  });

  it("trims whitespace from the comment", () => {
    const result = createReviewSchema.safeParse({ rating: 4, comment: "  Nice read  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.comment).toBe("Nice read");
  });
});
