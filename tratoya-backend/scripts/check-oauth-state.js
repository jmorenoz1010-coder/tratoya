#!/usr/bin/env node
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-oauth-state";
const { createOauthState, readOauthState } = require("../src/utils/oauthState");

const google = createOauthState("google");
const parsed = readOauthState(google);
if (!parsed || parsed.p !== "google") {
  console.error("oauthState: expected to parse google state");
  process.exit(1);
}
if (readOauthState("tampered." + google.split(".")[1])) {
  console.error("oauthState: tampered payload should fail");
  process.exit(1);
}
if (readOauthState(google.replace(/.$/, "x"))) {
  console.error("oauthState: tampered signature should fail");
  process.exit(1);
}
if (readOauthState(createOauthState("facebook")).p !== "facebook") {
  console.error("oauthState: facebook provider mismatch");
  process.exit(1);
}
console.log("oauthState ok");
