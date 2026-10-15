import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isOwnerEmail, isAdminEmail, ownerRole, isOwnerWhatsApp } from '../../src/lib/owner.ts'

test('restored owner helper distinguishes the product owner from configured admins', () => {
  const previous = process.env.ADMIN_EMAILS
  try {
    process.env.ADMIN_EMAILS = 'admin@example.com'
    assert.equal(isOwnerEmail(' ESHWARJAY0@GMAIL.COM '), true)
    assert.equal(ownerRole('eshwarjay0@gmail.com'), 'owner')
    assert.equal(isAdminEmail('admin@example.com'), true)
    assert.equal(isOwnerEmail('admin@example.com'), false)
    assert.equal(isOwnerEmail(null), false)
    assert.equal(isAdminEmail('ordinary@example.com'), false)
  } finally {
    if (previous === undefined) delete process.env.ADMIN_EMAILS
    else process.env.ADMIN_EMAILS = previous
  }
})

test('owner WhatsApp check remains closed without the application secret', () => {
  const previous = process.env.WHATSAPP_APP_SECRET
  try {
    delete process.env.WHATSAPP_APP_SECRET
    assert.equal(isOwnerWhatsApp('+15555550100'), false)
  } finally {
    if (previous === undefined) delete process.env.WHATSAPP_APP_SECRET
    else process.env.WHATSAPP_APP_SECRET = previous
  }
})
