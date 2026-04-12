import { z } from "zod";

export const countrySchema = z
  .enum(["us", "ca"])
  .optional()
  .describe("Country code (us or ca). Defaults to us.");

export const retailerSchema = z
  .string()
  .optional()
  .describe("Filter to a specific retailer (e.g. amazon, walmart, costco)");

export const daysSchema = z
  .number()
  .int()
  .positive()
  .optional()
  .describe("Number of days to look back");
