import { defineAuth } from "@aws-amplify/backend";

/**
 * Define and configure your auth resource
 * @see https://docs.amplify.aws/gen2/build-a-backend/auth
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  userAttributes: {
    // Standard attributes
    givenName: {
      mutable: true,
      required: false,
    },
    familyName: {
      mutable: true,
      required: false,
    },
    phoneNumber: {
      mutable: true,
      required: false,
    },
    // Custom attributes
    "custom:organizationName": {
      dataType: "String",
      mutable: true,
      maxLen: 100,
      minLen: 1,
    },
    "custom:municipality": {
      dataType: "String",
      mutable: true,
      maxLen: 100,
      minLen: 1,
    },
    "custom:accountType": {
      dataType: "String",
      mutable: true,
      maxLen: 20,
      minLen: 1,
    },
    "custom:accountTier": {
      dataType: "String",
      mutable: true,
      maxLen: 20,
      minLen: 1,
    },
    "custom:signUpForUpdates": {
      dataType: "Boolean",
      mutable: true,
    },
  },
});
