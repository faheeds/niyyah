import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const communityMembers = sqliteTable('community_members', {
  id: text('id').primaryKey(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').notNull().unique(),
  phone: text('phone'),
  ageGroup: text('age_group').notNull(),
  postcode: text('postcode').notNull(),
  interests: text('interests').notNull(),
  preferredContact: text('preferred_contact').notNull(),
  heardAboutUs: text('heard_about_us'),
  instagram: text('instagram'),
  tiktok: text('tiktok'),
  otherSocial: text('other_social'),
  updatesOptIn: integer('updates_opt_in', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const memberProfiles = sqliteTable('member_profiles', {
  userId: text('user_id').primaryKey(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull(),
  bio: text('bio'),
  postcode: text('postcode'),
  interests: text('interests').notNull().default('[]'),
  instagram: text('instagram'),
  tiktok: text('tiktok'),
  otherSocial: text('other_social'),
  discoverable: integer('discoverable', { mode: 'boolean' }).notNull().default(false),
  shareActivity: integer('share_activity', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const volunteerActivities = sqliteTable('volunteer_activities', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  organization: text('organization').notNull(),
  role: text('role').notNull(),
  hours: integer('hours').notNull(),
  activityDate: text('activity_date').notNull(),
  status: text('status').notNull().default('self_reported'),
  createdAt: text('created_at').notNull(),
})

export const memberConnections = sqliteTable('member_connections', {
  id: text('id').primaryKey(),
  requesterId: text('requester_id').notNull(),
  recipientId: text('recipient_id').notNull(),
  status: text('status').notNull().default('pending'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const organizations = sqliteTable('organizations', {
  id: text('id').primaryKey(), ownerUserId: text('owner_user_id').notNull().unique(), name: text('name').notNull(),
  organizationType: text('organization_type').notNull(), registrationNumber: text('registration_number'), email: text('email').notNull(),
  phone: text('phone').notNull(), website: text('website'), address: text('address').notNull(), postcode: text('postcode').notNull(),
  description: text('description').notNull(), safeguardingName: text('safeguarding_name').notNull(),
  safeguardingEmail: text('safeguarding_email').notNull(), status: text('status').notNull().default('pending'),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
})

export const organizationEvents = sqliteTable('organization_events', {
  id: text('id').primaryKey(), organizationId: text('organization_id').notNull(), title: text('title').notNull(),
  summary: text('summary').notNull(), interest: text('interest').notNull(), ageRange: text('age_range').notNull(),
  locationName: text('location_name').notNull(), address: text('address').notNull(), postcode: text('postcode').notNull(),
  startAt: text('start_at').notNull(), endAt: text('end_at').notNull(), capacity: integer('capacity'),
  eventType: text('event_type').notNull().default('community'), status: text('status').notNull().default('draft'),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
})

export const volunteerActivityOrganizations = sqliteTable('volunteer_activity_organizations', {
  activityId: text('activity_id').primaryKey(), organizationId: text('organization_id').notNull(),
  eventId: text('event_id'), createdAt: text('created_at').notNull(),
})

export const volunteerOpportunities = sqliteTable('volunteer_opportunities', {
  eventId:text('event_id').primaryKey(), compensationType:text('compensation_type').notNull().default('unpaid'),
  payDetails:text('pay_details'), createdAt:text('created_at').notNull(), updatedAt:text('updated_at').notNull(),
})

export const volunteerApplications = sqliteTable('volunteer_applications', {
  id:text('id').primaryKey(), eventId:text('event_id').notNull(), organizationId:text('organization_id').notNull(),
  userId:text('user_id').notNull(), applicantEmail:text('applicant_email').notNull(), applicantName:text('applicant_name').notNull(),
  status:text('status').notNull().default('new'), createdAt:text('created_at').notNull(), updatedAt:text('updated_at').notNull(),
})

export const eventParticipations = sqliteTable('event_participations', {
  id:text('id').primaryKey(), eventId:text('event_id').notNull(), userId:text('user_id').notNull(),
  status:text('status').notNull().default('going'), createdAt:text('created_at').notNull(), updatedAt:text('updated_at').notNull(),
})

export const eventSignupSlots = sqliteTable('event_signup_slots', {
  id:text('id').primaryKey(), eventId:text('event_id').notNull(), userId:text('user_id').notNull(),
  selectedDate:text('selected_date').notNull(), selectedTime:text('selected_time').notNull(),
  createdAt:text('created_at').notNull(), updatedAt:text('updated_at').notNull(),
})

export const eventVolunteerRequirements = sqliteTable('event_volunteer_requirements', {
  eventId:text('event_id').primaryKey(), genderAppropriateness:text('gender_appropriateness').notNull().default('Any gender'),
  locationPreference:text('location_preference'), travelRequired:integer('travel_required',{mode:'boolean'}).notNull().default(false),
  volunteersNeeded:integer('volunteers_needed').notNull().default(1), autoPause:integer('auto_pause',{mode:'boolean'}).notNull().default(true),
  preferredInterests:text('preferred_interests'), notes:text('notes'), createdAt:text('created_at').notNull(), updatedAt:text('updated_at').notNull(),
})

export const volunteerChallenges = sqliteTable('volunteer_challenges', {
  inviterUserId:text('inviter_user_id').primaryKey(), inviterEmail:text('inviter_email').notNull(),
  inviteCode:text('invite_code').notNull().unique(), createdAt:text('created_at').notNull(),
})

export const volunteerReferrals = sqliteTable('volunteer_referrals', {
  id:text('id').primaryKey(), inviterUserId:text('inviter_user_id').notNull(), inviteeEmail:text('invitee_email').notNull().unique(),
  inviteeUserId:text('invitee_user_id'), status:text('status').notNull().default('pending'), createdAt:text('created_at').notNull(), completedAt:text('completed_at'),
})

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(), email: text('email').notNull().unique(), displayName: text('display_name').notNull(),
  passwordHash: text('password_hash'), passwordSalt: text('password_salt'), googleSub: text('google_sub').unique(),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
})

export const authSessions = sqliteTable('auth_sessions', {
  id: text('id').primaryKey(), accountId: text('account_id').notNull(),
  createdAt: text('created_at').notNull(), expiresAt: text('expires_at').notNull(),
})
