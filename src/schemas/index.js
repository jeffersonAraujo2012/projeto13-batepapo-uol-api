import Joi from "joi";

export const participants = Joi.object({
  name: Joi.string().min(1).required(),
});
