import {
  contactProfileSchema,
  contactSettingsSchema,
  type ContactProfile,
  type ContactSettings,
  type PublicContact,
  type UpdateContactSettingsRequest,
} from "@shoppp/contracts";
import type { Context } from "hono";

import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";
import { prepareAuditEvent } from "../iam/audit";
import { actorTypeForPrincipal } from "../iam/permissions";
import { readLaunchConfiguration } from "./launch-configuration";

const PROFILE_KEY = "contact_profile";
const LAUNCH_KEY = "launch_configuration";
const GUARD_KEY = "contact_write_guard";

interface SettingRow { value_json: string; updated_at: string }
interface StoredProfile { version: string; profile: ContactProfile }

const emptyProfile: ContactProfile = {
  publishSupportEmail: false,
  publishPrivacyEmail: false,
  publicPhone: null,
  serviceHours: null,
  timeZone: null,
  locations: [],
  socials: [],
};

async function row(db: D1Database, key: string): Promise<SettingRow | null> {
  return db.prepare("SELECT value_json, updated_at FROM settings WHERE key = ?")
    .bind(key).first<SettingRow>();
}

async function launchVersion(value: string | null): Promise<string | null> {
  if (value === null) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function storedProfile(value: string | null): StoredProfile | null {
  if (value === null) return null;
  const decoded = JSON.parse(value) as StoredProfile;
  const profile = contactProfileSchema.parse(decoded.profile);
  if (typeof decoded.version !== "string") throw new Error("Invalid contact profile version");
  return { version: decoded.version, profile };
}

export function publicContactFromSettings(
  profile: ContactProfile,
  supportEmail: string,
  privacyContactEmail: string,
): PublicContact {
  return {
    supportEmail: profile.publishSupportEmail ? supportEmail : null,
    privacyEmail: profile.publishPrivacyEmail ? privacyContactEmail : null,
    publicPhone: profile.publicPhone,
    serviceHours: profile.serviceHours,
    timeZone: profile.timeZone,
    locations: profile.locations.filter((location) => location.visible),
    socials: profile.socials.filter((social) => social.visible),
  };
}

export async function getContactSettings(context: Context<ApiEnvironment>): Promise<ContactSettings> {
  const [launch, profileRow] = await Promise.all([
    row(context.env.DB, LAUNCH_KEY),
    row(context.env.DB, PROFILE_KEY),
  ]);
  const launchRead = await readLaunchConfiguration(context);
  const stored = storedProfile(profileRow?.value_json ?? null);
  const profile = stored?.profile ?? emptyProfile;
  const configuration = launch
    ? JSON.parse(launch.value_json) as typeof launchRead.configuration
    : launchRead.configuration;
  return contactSettingsSchema.parse({
    profile,
    supportEmail: configuration.supportEmail,
    privacyContactEmail: configuration.privacyContactEmail,
    launchVersion: await launchVersion(launch?.value_json ?? null),
    profileVersion: stored?.version ?? null,
    updatedAt: profileRow?.updated_at ?? null,
    publicContact: publicContactFromSettings(
      profile, configuration.supportEmail, configuration.privacyContactEmail,
    ),
  });
}

export async function updateContactSettings(
  context: Context<ApiEnvironment>,
  input: UpdateContactSettingsRequest,
): Promise<ContactSettings> {
  const [launchRow, profileRow] = await Promise.all([
    row(context.env.DB, LAUNCH_KEY),
    row(context.env.DB, PROFILE_KEY),
  ]);
  const currentLaunchVersion = await launchVersion(launchRow?.value_json ?? null);
  const currentProfileVersion = storedProfile(profileRow?.value_json ?? null)?.version ?? null;
  if (
    input.expectedLaunchVersion !== currentLaunchVersion ||
    input.expectedProfileVersion !== currentProfileVersion
  ) {
    throw new ApiError(409, "contact_settings_conflict", "Contact settings changed. Reload before saving.");
  }

  const launchRead = await readLaunchConfiguration(context);
  const configuration = launchRow
    ? JSON.parse(launchRow.value_json) as typeof launchRead.configuration
    : launchRead.configuration;
  const now = new Date().toISOString();
  const version = crypto.randomUUID();
  const principal = context.get("principal");
  const statements = [
    // D1 batch is transactional. The invalid JSON branch trips the settings CHECK constraint
    // if either source changed after the initial read, rolling back both writes and the audit.
    context.env.DB.prepare(
      `INSERT INTO settings (key, value_json, updated_at)
       VALUES (?, CASE WHEN
         (SELECT value_json FROM settings WHERE key = ?) IS ? AND
         (SELECT value_json FROM settings WHERE key = ?) IS ?
         THEN '{}' ELSE 'invalid' END, ?)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json,
         updated_at = excluded.updated_at`,
    ).bind(GUARD_KEY, LAUNCH_KEY, launchRow?.value_json ?? null,
      PROFILE_KEY, profileRow?.value_json ?? null, now),
    context.env.DB.prepare(
      `INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json,
         updated_at = excluded.updated_at`,
    ).bind(LAUNCH_KEY, JSON.stringify({
      ...configuration,
      supportEmail: input.supportEmail,
      privacyContactEmail: input.privacyContactEmail,
    }), now),
    context.env.DB.prepare(
      `INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json,
         updated_at = excluded.updated_at`,
    ).bind(PROFILE_KEY, JSON.stringify({ version, profile: input.profile }), now),
    prepareAuditEvent(context.env.DB, {
      action: "settings.contact.update",
      actorId: principal.id,
      actorType: actorTypeForPrincipal(principal),
      id: crypto.randomUUID(),
      metadata: { profileVersion: version, locations: input.profile.locations.length,
        socials: input.profile.socials.length },
      reason: input.reason,
      requestId: context.get("requestId"),
      result: "succeeded",
      targetId: PROFILE_KEY,
      targetType: "setting",
    }),
    context.env.DB.prepare("DELETE FROM settings WHERE key = ?").bind(GUARD_KEY),
  ];
  try {
    await context.env.DB.batch(statements);
  } catch (error) {
    const fresh = await Promise.all([
      row(context.env.DB, LAUNCH_KEY),
      row(context.env.DB, PROFILE_KEY),
    ]);
    if (fresh[0]?.value_json !== launchRow?.value_json ||
        fresh[1]?.value_json !== profileRow?.value_json) {
      throw new ApiError(409, "contact_settings_conflict", "Contact settings changed. Reload before saving.");
    }
    throw error;
  }
  return getContactSettings(context);
}
