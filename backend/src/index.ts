import dotenv from 'dotenv'
dotenv.config()
import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { pool } from './db'
import { Resend } from 'resend'
import Anthropic from '@anthropic-ai/sdk'

const app = express()
const PORT = 3001
const JWT_SECRET = process.env.JWT_SECRET || 'claimrx-secret-key-change-in-production'
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null

app.use(cors())
app.use(express.json())

const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  if (!token) { res.status(401).json({ error: 'Access token required' }); return }
  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) { res.status(403).json({ error: 'Invalid or expired token' }); return }
    (req as any).user = user; next()
  })
}

app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body
    if (!email || !password || !name) { res.status(400).json({ error: 'Email, password, and name are required' }); return }
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email])
    if (existingUser.rows.length > 0) { res.status(400).json({ error: 'Email already registered' }); return }
    const hashedPassword = await bcrypt.hash(password, 10)
    const result = await pool.query('INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name', [email, hashedPassword, name])
    const user = result.rows[0]
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' })
    res.status(201).json({ user, token })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Registration failed' }) }
})

app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body
    if (!email || !password) { res.status(400).json({ error: 'Email and password are required' }); return }
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email])
    if (result.rows.length === 0) { res.status(401).json({ error: 'Invalid email or password' }); return }
    const user = result.rows[0]
    const validPassword = await bcrypt.compare(password, user.password)
    if (!validPassword) { res.status(401).json({ error: 'Invalid email or password' }); return }
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' })
    res.json({ user: { id: user.id, email: user.email, name: user.name }, token })
  } catch (err) { console.error('Login error:', err); res.status(500).json({ error: 'Login failed: ' + (err as any).message }) }
})

app.get('/api/auth/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id
    const result = await pool.query('SELECT id, email, name FROM users WHERE id = $1', [userId])
    if (result.rows.length === 0) { res.status(404).json({ error: 'User not found' }); return }
    res.json(result.rows[0])
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to get user' }) }
})

app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body
    if (!email) { res.status(400).json({ error: 'Email is required' }); return }
    const result = await pool.query('SELECT id, email, name FROM users WHERE email = $1', [email])
    if (result.rows.length === 0) { res.json({ message: 'If an account with that email exists, a reset link has been sent.' }); return }
    const user = result.rows[0]
    const resetToken = jwt.sign({ id: user.id, email: user.email, purpose: 'password-reset' }, JWT_SECRET, { expiresIn: '1h' })
    await pool.query("UPDATE users SET reset_token = $1, reset_token_expires = NOW() + INTERVAL '1 hour' WHERE id = $2", [resetToken, user.id])
    const resetUrl = (process.env.FRONTEND_URL || 'https://claimrx.vercel.app') + '/reset-password?token=' + resetToken
    await resend.emails.send({ from: 'ClaimRx <noreply@claimrx.io>', to: email, subject: 'Reset your ClaimRx password', html: '<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:20px;"><h2 style="color:#10b981;">ClaimRx</h2><p>Hi ' + user.name + ',</p><p>Click below to reset your password:</p><a href="' + resetUrl + '" style="display:inline-block;background-color:#10b981;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;margin:16px 0;">Reset Password</a><p style="color:#666;font-size:14px;">This link expires in 1 hour.</p></div>' })
    res.json({ message: 'If an account with that email exists, a reset link has been sent.' })
  } catch (err) { console.error('Forgot password error:', err); res.status(500).json({ error: 'Failed to process request' }) }
})

app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body
    if (!token || !password) { res.status(400).json({ error: 'Token and new password are required' }); return }
    let decoded: any
    try { decoded = jwt.verify(token, JWT_SECRET) } catch (err) { res.status(400).json({ error: 'Invalid or expired reset token' }); return }
    if (decoded.purpose !== 'password-reset') { res.status(400).json({ error: 'Invalid reset token' }); return }
    const result = await pool.query('SELECT id FROM users WHERE id = $1 AND reset_token = $2 AND reset_token_expires > NOW()', [decoded.id, token])
    if (result.rows.length === 0) { res.status(400).json({ error: 'Invalid or expired reset token' }); return }
    const hashedPassword = await bcrypt.hash(password, 10)
    await pool.query('UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2', [hashedPassword, decoded.id])
    res.json({ message: 'Password reset successful. You can now log in.' })
  } catch (err) { console.error('Reset password error:', err); res.status(500).json({ error: 'Failed to reset password' }) }
})

app.get('/api/health', (_req: Request, res: Response) => { res.json({ status: 'ok', timestamp: new Date().toISOString(), hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY, anthropicClient: !!anthropic }) })

app.get('/api/claims', authenticateToken, async (_req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT c.id, c.patient, c.amount, c.payer, c.denial_reason as "denialReason", c.denied_date as "deniedDate", c.deadline, c.status, c.patient_email as "patientEmail", c.patient_phone as "patientPhone", c.service_date as "serviceDate", c.service_code as "serviceCode", c.diagnosis_code as "diagnosisCode", p.phone as "payerPhone", p.email as "payerEmail", p.fax as "payerFax", p.appeals_address as "payerAppealsAddress", p.avg_response_days as "payerAvgResponseDays", p.committed_response_days as "payerCommittedResponseDays" FROM claims c LEFT JOIN payers p ON c.payer = p.name ORDER BY c.denied_date DESC')
    res.json(result.rows)
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }) }
})

app.post('/api/claims', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { patient, amount, payer, denialReason, deniedDate, deadline, patientEmail, patientPhone, serviceDate, serviceCode, diagnosisCode } = req.body
    if (!patient || !amount || !payer || !denialReason || !deniedDate || !deadline) { res.status(400).json({ error: 'Patient, amount, payer, denialReason, deniedDate, and deadline are required' }); return }
    const countResult = await pool.query('SELECT COUNT(*) FROM claims')
    const count = parseInt(countResult.rows[0].count) + 1
    const newId = 'CLM-' + String(count).padStart(3, '0')
    const result = await pool.query('INSERT INTO claims (id, patient, amount, payer, denial_reason, denied_date, deadline, status, patient_email, patient_phone, service_date, service_code, diagnosis_code) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id, patient, amount, payer, denial_reason as "denialReason", denied_date as "deniedDate", deadline, status, patient_email as "patientEmail", patient_phone as "patientPhone", service_date as "serviceDate", service_code as "serviceCode", diagnosis_code as "diagnosisCode"', [newId, patient, amount, payer, denialReason, deniedDate, deadline, 'pending', patientEmail || null, patientPhone || null, serviceDate || null, serviceCode || null, diagnosisCode || null])
    res.status(201).json(result.rows[0])
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create claim' }) }
})

app.get('/api/claims/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT id, patient, amount, payer, denial_reason as "denialReason", denied_date as "deniedDate", deadline, status FROM claims WHERE id = $1', [req.params.id])
    if (result.rows.length === 0) { res.status(404).json({ error: 'Claim not found' }); return }
    res.json(result.rows[0])
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }) }
})

app.patch('/api/claims/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { status } = req.body
    const result = await pool.query('UPDATE claims SET status = $1 WHERE id = $2 RETURNING id, patient, amount, payer, denial_reason as "denialReason", denied_date as "deniedDate", deadline, status', [status, req.params.id])
    if (result.rows.length === 0) { res.status(404).json({ error: 'Claim not found' }); return }
    res.json(result.rows[0])
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }) }
})

app.get('/api/payers', authenticateToken, async (_req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT id, name, phone, fax, email, address, appeals_address as "appealsAddress", avg_response_days as "avgResponseDays", committed_response_days as "committedResponseDays", website FROM payers ORDER BY name')
    res.json(result.rows)
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }) }
})

app.get('/api/appeals', authenticateToken, async (_req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT id, claim_id as "claimId", patient, amount, payer, submitted_date as "submittedDate", status, recovered_amount as "recoveredAmount", decided_date as "decidedDate", CASE WHEN decided_date IS NOT NULL AND submitted_date IS NOT NULL THEN decided_date - submitted_date ELSE NULL END as "daysToDecision" FROM appeals ORDER BY submitted_date DESC')
    res.json(result.rows)
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }) }
})

app.post('/api/appeals', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { claimId, patient, amount, payer } = req.body
    const countResult = await pool.query('SELECT COUNT(*) FROM appeals')
    const count = parseInt(countResult.rows[0].count) + 1
    const newId = 'APL-' + String(count).padStart(3, '0')
    const result = await pool.query("INSERT INTO appeals (id, claim_id, patient, amount, payer, submitted_date, status) VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, 'pending') RETURNING id, claim_id as \"claimId\", patient, amount, payer, submitted_date as \"submittedDate\", status, recovered_amount as \"recoveredAmount\"", [newId, claimId, patient, amount, payer])
    await pool.query('UPDATE claims SET status = $1 WHERE id = $2', ['appealed', claimId])
    res.status(201).json(result.rows[0])
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }) }
})

app.patch('/api/appeals/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { status, recoveredAmount } = req.body
    let query, params
    if (status === 'approved' || status === 'denied') {
      query = 'UPDATE appeals SET status = $1, recovered_amount = $2, decided_date = CURRENT_DATE WHERE id = $3 RETURNING id, claim_id as "claimId", patient, amount, payer, submitted_date as "submittedDate", status, recovered_amount as "recoveredAmount", decided_date as "decidedDate", CASE WHEN decided_date IS NOT NULL AND submitted_date IS NOT NULL THEN decided_date - submitted_date ELSE NULL END as "daysToDecision"'
      params = [status, recoveredAmount, req.params.id]
    } else {
      query = 'UPDATE appeals SET status = $1, recovered_amount = $2 WHERE id = $3 RETURNING id, claim_id as "claimId", patient, amount, payer, submitted_date as "submittedDate", status, recovered_amount as "recoveredAmount", decided_date as "decidedDate"'
      params = [status, recoveredAmount, req.params.id]
    }
    const result = await pool.query(query, params)
    if (result.rows.length === 0) { res.status(404).json({ error: 'Appeal not found' }); return }
    res.json(result.rows[0])
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }) }
})

app.post('/api/appeals/generate', authenticateToken, async (req: Request, res: Response) => {
  const { claim } = req.body

  if (!anthropic) {
    const letter = 'Dear Claims Review Department,\n\nI am writing to formally appeal the denial of claim ' + claim.id + ' for patient ' + claim.patient + ', dated ' + claim.deniedDate + '.\n\nThe claim in the amount of $' + claim.amount + ' was denied for the following reason: "' + claim.denialReason + '".\n\nAfter careful review, we believe this denial should be reconsidered as the service was medically necessary.\n\nSincerely,\nClaimRx Medical Billing'
    res.json({ letter })
    return
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: 'You are a medical billing specialist writing a formal insurance claim appeal letter. Write a compelling, professional appeal letter using the following claim details. The letter should:\n\n1. Cite specific medical necessity arguments relevant to the denial reason\n2. Reference applicable CPT/ICD-10 codes and clinical guidelines when provided\n3. Address the specific denial reason with targeted counter-arguments\n4. Follow standard appeal letter formatting for the specific payer\n5. Include references to relevant payer policy sections where applicable\n6. Be persuasive but professional in tone\n\nClaim Details:\n- Claim ID: ' + claim.id + '\n- Patient: ' + claim.patient + '\n- Amount: $' + claim.amount + '\n- Payer: ' + claim.payer + '\n- Denial Reason: ' + claim.denialReason + '\n- Denied Date: ' + claim.deniedDate + '\n- Deadline: ' + claim.deadline + (claim.serviceCode ? '\n- CPT Code: ' + claim.serviceCode : '') + (claim.diagnosisCode ? '\n- ICD-10 Code: ' + claim.diagnosisCode : '') + (claim.serviceDate ? '\n- Service Date: ' + claim.serviceDate : '') + '\n\nWrite the appeal letter now. Do not include any preamble or explanation - just the letter itself.'
      }]
    })

    const letter = message.content[0].type === 'text' ? message.content[0].text : 'Error generating letter'
    res.json({ letter })
  } catch (err) {
    console.error('AI generation error:', err)
    res.status(500).json({ error: 'Failed to generate appeal letter' })
  }
})

app.get('/api/stats', authenticateToken, async (_req: Request, res: Response) => {
  try {
    const claimsResult = await pool.query('SELECT SUM(amount) as total, COUNT(*) as count FROM claims')
    const appealsResult = await pool.query("SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'approved') as approved, COUNT(*) FILTER (WHERE status = 'denied') as denied, COUNT(*) FILTER (WHERE status = 'pending' OR status = 'in-review') as pending, COALESCE(SUM(recovered_amount), 0) as recovered FROM appeals")
    const totalDenied = parseInt(claimsResult.rows[0].total) || 0
    const totalClaims = parseInt(claimsResult.rows[0].count) || 0
    const approved = parseInt(appealsResult.rows[0].approved) || 0
    const denied = parseInt(appealsResult.rows[0].denied) || 0
    const totalRecovered = parseInt(appealsResult.rows[0].recovered) || 0
    const pendingAppeals = parseInt(appealsResult.rows[0].pending) || 0
    const totalAppeals = parseInt(appealsResult.rows[0].total) || 0
    const successRate = (approved + denied) > 0 ? Math.round((approved / (approved + denied)) * 100) : 0
    res.json({ totalDenied, totalRecovered, successRate, pendingAppeals, totalClaims, totalAppeals })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }) }
})

app.listen(PORT, () => { console.log('ClaimRx API running on http://localhost:' + PORT) })
