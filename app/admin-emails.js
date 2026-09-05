// Shared allowlist of admin sign-in emails (temporary hardcoded list - see
// backlog: this should become a real roles system later, tracked separately
// so it isn't lost). Add a teammate's Niyyah sign-in email here to give them
// access to /admin.
//
// Every public sign-up path (app/api/auth/signup/route.js and
// app/api/signup/route.js) refuses to register any address on this list, so
// nobody can squat one of these emails with a self-asserted password
// account. That's what makes it safe for app/api/admin-organizations/route.js
// to grant admin access to ANY account with a matching email, without also
// requiring Google verification - see README-CLAUDE-GITHUB-SETUP.md section 6
// for how the very first admin account actually gets created.
export const ADMIN_EMAILS = ['faheed.subhani@gmail.com']
