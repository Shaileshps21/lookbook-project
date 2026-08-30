import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { Address } from "../models/Address";
import type { UpsertAddressInput } from "../validators/addressValidators";

export const getMyAddresses = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const addresses = await Address.find({ user: req.user.id }).sort("-isDefault -createdAt");
  return ApiResponse.ok(res, addresses);
});

export const createAddress = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const input = req.body as UpsertAddressInput;
  const existingCount = await Address.countDocuments({ user: req.user.id });

  if (input.isDefault || existingCount === 0) {
    await Address.updateMany({ user: req.user.id }, { isDefault: false });
  }

  const address = await Address.create({
    ...input,
    user: req.user.id,
    isDefault: input.isDefault || existingCount === 0,
  });

  return ApiResponse.created(res, address, "Address saved");
});

export const updateAddress = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const address = await Address.findOne({ _id: req.params.id, user: req.user.id });
  if (!address) throw ApiError.notFound("Address not found");

  const input = req.body as UpsertAddressInput;
  if (input.isDefault) {
    await Address.updateMany({ user: req.user.id }, { isDefault: false });
  }

  Object.assign(address, input);
  await address.save();

  return ApiResponse.ok(res, address, "Address updated");
});

export const deleteAddress = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const address = await Address.findOneAndDelete({ _id: req.params.id, user: req.user.id });
  if (!address) throw ApiError.notFound("Address not found");

  if (address.isDefault) {
    const another = await Address.findOne({ user: req.user.id }).sort("-createdAt");
    if (another) {
      another.isDefault = true;
      await another.save();
    }
  }

  return ApiResponse.ok(res, null, "Address deleted");
});
