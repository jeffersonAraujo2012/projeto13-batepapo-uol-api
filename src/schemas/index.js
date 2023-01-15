import Joi from "joi";

export const participants = Joi.object({
  name: Joi.string().min(1).required(),
});

export const messages = Joi.object({
  to: Joi.string().required(),
  text: Joi.string().required(),
  type: Joi.string().allow("message","private_message").required(),
});
