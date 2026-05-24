/**
 * seed.js — Load test fixture generator
 *
 * Node.js script (CommonJS). Run with: node load-tests/helpers/seed.js
 * Requires: MONGODB_URI (or DATABASE_URL) and JWT_SECRET in environment.
 *
 * Creates:
 *   - 1 SUPER_ADMIN user
 *   - 10 BROTHER users
 *   - 10 SISTER users
 *   - 2 BROTHER-typed groups
 *   - 2 SISTER-typed groups
 *   - 5 posts per group (20 total)
 *
 * Writes fixtures.json to load-tests/fixtures.json.
 * Idempotent: deletes all prior "loadtest-" prefixed data before seeding.
 */

'use strict';

// ── Bootstrap TypeScript support ─────────────────────────────────────────────
// seed.js needs to import TypeScript models from src/. We use ts-node/register
// so require() can load .ts files directly without a separate build step.
require('ts-node').register({
  project: require('path').join(__dirname, '../../tsconfig.json'),
  transpileOnly: true,
});

// ── Env loading ───────────────────────────────────────────────────────────────
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { faker } = require('@faker-js/faker');

// ── Validate required env vars ────────────────────────────────────────────────
const MONGODB_URI =
  process.env.LOAD_TEST_DB ||
  process.env.DATABASE_URL ||
  process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('[seed] ERROR: No MongoDB URI found.');
  console.error('[seed] Set LOAD_TEST_DB, DATABASE_URL, or MONGODB_URI in your environment.');
  console.error('[seed] Example: set LOAD_TEST_DB=mongodb://localhost:27017/okjt100');
  process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('[seed] ERROR: JWT_SECRET environment variable is not set.');
  console.error('[seed] Please set it in your .env file or environment before running this script.');
  process.exit(1);
}

const JWT_EXPIRE = process.env.JWT_EXPIRE_IN || '30d';
const FIXTURES_PATH = path.join(__dirname, '../fixtures.json');
const EMAIL_PREFIX = 'loadtest-';

// ── Import Mongoose models (TypeScript via ts-node) ───────────────────────────
const { User } = require('../../src/app/modules/user/user.model');
const { Group, GroupPost, GroupMember } = require('../../src/app/modules/group/group.model');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Sign a JWT token for a user (matches what the auth middleware expects).
 */
function signToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
      email: user.email,
      tokenVersion: 0,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRE },
  );
}

/**
 * Hash a password synchronously.
 */
function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}

// ── Main seed function ────────────────────────────────────────────────────────

async function seed() {
  console.log('[seed] Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('[seed] Connected.');

  // ── Idempotent cleanup ──────────────────────────────────────────────────────
  console.log('[seed] Cleaning up previous load-test data...');
  // Collect IDs before deleting users (for GroupMember cleanup)
  const loadTestUserIds = await User.find({ email: { $regex: `^${EMAIL_PREFIX}` } }).distinct('_id');
  const loadTestGroupIds = await Group.find({ category: 'load-testing' }).distinct('_id');

  await GroupMember.deleteMany({ $or: [
    { userId: { $in: loadTestUserIds } },
    { groupId: { $in: loadTestGroupIds } },
  ]});
  await GroupPost.deleteMany({ content: { $regex: /^load-test-seed/ } });
  await User.deleteMany({ email: { $regex: `^${EMAIL_PREFIX}` } });
  await Group.deleteMany({ category: 'load-testing' });
  console.log('[seed] Cleanup complete.');

  // ── Create SUPER_ADMIN ──────────────────────────────────────────────────────
  console.log('[seed] Creating SUPER_ADMIN user...');
  const adminUser = await User.create({
    name: 'Load Test Admin',
    role: 'SUPER_ADMIN',
    email: `${EMAIL_PREFIX}admin@test.com`,
    password: hashPassword('LoadTest123!'),
    status: 'ACTIVE',
    isVerified: true,
    dateOfBirth: new Date('1985-01-01'),
    profileImage: '/default-avatar.svg',
    tokenVersion: 0,
  });

  // ── Create 50 BROTHER users (enough for 50 VU read_load scenario) ──────────
  console.log('[seed] Creating 50 BROTHER users...');
  const brotherUsers = [];
  for (let i = 0; i < 50; i++) {
    const user = await User.create({
      name: `Load Test Brother ${i}`,
      role: 'BROTHER',
      email: `${EMAIL_PREFIX}brother-${i}@test.com`,
      password: hashPassword('LoadTest123!'),
      status: 'ACTIVE',
      isVerified: true,
      dateOfBirth: new Date('1990-01-01'),
      revertDate: new Date(),
      profileImage: '/default-avatar.svg',
      verificationImage: 'https://placeholder.com/verification.jpg',
      verificationVideo: 'https://placeholder.com/verification.mp4',
      tokenVersion: 0,
    });
    brotherUsers.push(user);
  }

  // ── Create 20 SISTER users ──────────────────────────────────────────────────
  console.log('[seed] Creating 20 SISTER users...');
  const sisterUsers = [];
  for (let i = 0; i < 20; i++) {
    const user = await User.create({
      name: `Load Test Sister ${i}`,
      role: 'SISTER',
      email: `${EMAIL_PREFIX}sister-${i}@test.com`,
      password: hashPassword('LoadTest123!'),
      status: 'ACTIVE',
      isVerified: true,
      dateOfBirth: new Date('1992-01-01'),
      revertDate: new Date(),
      profileImage: '/default-avatar.svg',
      verificationImage: 'https://placeholder.com/verification.jpg',
      verificationVideo: 'https://placeholder.com/verification.mp4',
      tokenVersion: 0,
    });
    sisterUsers.push(user);
  }

  // ── Create 2 BROTHER groups ─────────────────────────────────────────────────
  console.log('[seed] Creating 2 BROTHER groups...');
  const brotherGroups = [];
  for (let i = 0; i < 2; i++) {
    const group = await Group.create({
      name: `Load Test Brothers Group ${i}`,
      description: faker.lorem.sentence(),
      userType: 'BROTHER',
      category: 'load-testing',
      memberCount: 0,
    });
    brotherGroups.push(group);
  }

  // ── Create 2 SISTER groups ──────────────────────────────────────────────────
  console.log('[seed] Creating 2 SISTER groups...');
  const sisterGroups = [];
  for (let i = 0; i < 2; i++) {
    const group = await Group.create({
      name: `Load Test Sisters Group ${i}`,
      description: faker.lorem.sentence(),
      userType: 'SISTER',
      category: 'load-testing',
      memberCount: 0,
    });
    sisterGroups.push(group);
  }

  // ── Add all BROTHER users as members of BROTHER groups ─────────────────────
  console.log('[seed] Adding BROTHER users as group members...');
  for (const group of brotherGroups) {
    for (const user of brotherUsers) {
      await GroupMember.create({
        groupId: group._id,
        userId: user._id,
        role: 'member',
      });
    }
    await Group.findByIdAndUpdate(group._id, { memberCount: brotherUsers.length });
  }

  // ── Add all SISTER users as members of SISTER groups ────────────────────────
  console.log('[seed] Adding SISTER users as group members...');
  for (const group of sisterGroups) {
    for (const user of sisterUsers) {
      await GroupMember.create({
        groupId: group._id,
        userId: user._id,
        role: 'member',
      });
    }
    await Group.findByIdAndUpdate(group._id, { memberCount: sisterUsers.length });
  }

  // ── Create 5 posts per group (20 total) ─────────────────────────────────────
  console.log('[seed] Creating posts...');
  const posts = [];
  const allGroups = [...brotherGroups, ...sisterGroups];
  for (const group of allGroups) {
    for (let i = 0; i < 5; i++) {
      const post = await GroupPost.create({
        groupId: group._id,
        userId: adminUser._id,
        content: `load-test-seed ${faker.lorem.sentence()}`,
        attachments: [],
        likesCount: 0,
        commentsCount: 0,
        isPinned: false,
      });
      posts.push({ id: post._id.toString(), groupId: group._id.toString() });
    }
  }

  // ── Build fixtures object ───────────────────────────────────────────────────
  const fixtures = {
    adminUser: {
      id: adminUser._id.toString(),
      email: adminUser.email,
      token: signToken(adminUser),
    },
    brotherUsers: brotherUsers.map(u => ({
      id: u._id.toString(),
      email: u.email,
      token: signToken(u),
    })),
    sisterUsers: sisterUsers.map(u => ({
      id: u._id.toString(),
      email: u.email,
      token: signToken(u),
    })),
    brotherGroups: brotherGroups.map(g => ({
      id: g._id.toString(),
      name: g.name,
    })),
    sisterGroups: sisterGroups.map(g => ({
      id: g._id.toString(),
      name: g.name,
    })),
    posts,
  };

  // ── Write fixtures.json ─────────────────────────────────────────────────────
  fs.writeFileSync(FIXTURES_PATH, JSON.stringify(fixtures, null, 2));
  console.log(`[seed] fixtures.json written to ${FIXTURES_PATH}`);
  console.log(`[seed] Summary:`);
  console.log(`  - 1 SUPER_ADMIN user`);
  console.log(`  - ${brotherUsers.length} BROTHER users`);
  console.log(`  - ${sisterUsers.length} SISTER users`);
  console.log(`  - ${brotherGroups.length} BROTHER groups`);
  console.log(`  - ${sisterGroups.length} SISTER groups`);
  console.log(`  - ${posts.length} posts (5 per group)`);
  console.log('[seed] Done.');
}

// ── Run ───────────────────────────────────────────────────────────────────────
seed()
  .then(() => {
    mongoose.disconnect();
    process.exit(0);
  })
  .catch(err => {
    console.error('[seed] FATAL ERROR:', err.message);
    mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
