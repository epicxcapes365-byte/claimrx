import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { pool } from './db'

const app = express()
const PORT = 3001
const JWT_SECRET = process.env.JWT_SECRET || 'claimrx-secret-key-change-in-production'

// Middleware
app.use(cors())
app.use(express.json())

// Auth middleware
const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  
  if (!token) {
    res.status(401).json({ error: 'Access token required' })
    return
  }
  
  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      res.status(403).json({ error: 'Invalid or expired token' })
      return
    }
    (req as any).user = user
    next()
  })
}

// ============ AUTH ROUTES ============

// Register
app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body
    
    if (!email || !password || !name) {
      res.status(400).json({ error: 'Email, password, and name are required' })
      return
    }
    
    // Check if user exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email])
    if (existingUser.rows.length > 0) {
      res.status(400).json({ error: 'Email already registered' })
      return
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)
    
    // Create user
    const result = await pool.query(
      'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name',
      [email, hashedPassword, name]
    )
    
    const user = result.rows[0]
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' })
    
    res.status(201).json({ user, token })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Registration failed' })
  }
})

// Login
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body
    
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' })
      return
    }
    
    // Find user
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email])
    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Invalid email or password' })
      return
    }
    
    const user = result.rows[0]
    
    // Check password
    const validPassword = await bcrypt.compare(password, user.password)
    if (!validPassword) {
      res.status(401).json({ error: 'Invalid email or password' })
      return
    }
    
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' })
    
    res.json({ 
      user: { id: user.id, email: user.email, name: user.name }, 
      token 
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Login failed' })
  }
})

// Get current user
app.get('/api/auth/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id
    const result = await pool.query('SELECT id, email, name FROM users WHERE id = $1', [userId])
    
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to get user' })
  }
})
// Forgot Password
app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body
    if (!email) {
      res.status(400).json({ error: 'Email is required' })
      return
    }
    const result = await pool.query('SELECT id, email, name FROM users WHERE email = $1', [email])
    if (result.rows.length === 0) {
      res.json({ message: 'If an account with that email exists, a reset link has been sent.' })
      return
    }
    const user = result.rows[0]
    const resetToken = jwt.sign({ id: user.id, email: user.email, purpose: 'password-reset' }, JWT_SECRET, { expiresIn: '1h' })
    await pool.query('UPDATE users SET reset_token = $1, reset_token_expires = NOW() + INTERVAL \'1 hour\' WHERE id = $2', [resetToken, user.id])
    console.log(`\n📧 Password reset requested for ${email}`)
    console.log(`🔗 Reset token: ${resetToken}\n`)
    res.json({ message: 'If an account with that email exists, a reset link has been sent.' })
  } catch (err) {
    console.error('Forgot password error:', err)
    res.status(500).json({ error: 'Failed to process request' })
  }
})

// Reset Password
app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body
    if (!token || !password) {
      res.status(400).json({ error: 'Token and new password are required' })
      return
    }
    let decoded: any
    try {
      decoded = jwt.verify(token, JWT_SECRET)
    } catch (err) {
      res.status(400).json({ error: 'Invalid or expired reset token' })
      return
    }
    if (decoded.purpose !== 'password-reset') {
      res.status(400).json({ error: 'Invalid reset token' })
      return
    }
    const result = await pool.query('SELECT id FROM users WHERE id = $1 AND reset_token = $2 AND reset_token_expires > NOW()', [decoded.id, token])
    if (result.rows.length === 0) {
      res.status(400).json({ error: 'Invalid or expired reset token' })
      return
    }
    const hashedPassword = await bcrypt.hash(password, 10)
    await pool.query('UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2', [hashedPassword, decoded.id])
    res.json({ message: 'Password reset successful. You can now log in.' })
  } catch (err) {
    console.error('Reset password error:', err)
    res.status(500).json({ error: 'Failed to reset password' })
  }
})

// ============ PROTECTED ROUTES ============

// Health check (public)
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Get all claims (protected)
app.get('/api/claims', authenticateToken, async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT id, patient, amount, payer, 
             denial_reason as "denialReason", 
             denied_date as "deniedDate", 
             deadline, status 
      FROM claims ORDER BY denied_date DESC
    `)
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Database error' })
  }
})

// Get single claim (protected)
app.get('/api/claims/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, patient, amount, payer, denial_reason as "denialReason", denied_date as "deniedDate", deadline, status FROM claims WHERE id = $1',
      [req.params.id]
    )
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Claim not found' })
      return
    }
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Database error' })
  }
})

// Update claim status (protected)
app.patch('/api/claims/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { status } = req.body
    const result = await pool.query(
      'UPDATE claims SET status = $1 WHERE id = $2 RETURNING id, patient, amount, payer, denial_reason as "denialReason", denied_date as "deniedDate", deadline, status',
      [status, req.params.id]
    )
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Claim not found' })
      return
    }
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Database error' })
  }
})

// Get all appeals (protected)
app.get('/api/appeals', authenticateToken, async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT id, claim_id as "claimId", patient, amount, payer,
             submitted_date as "submittedDate", status,
             recovered_amount as "recoveredAmount"
      FROM appeals ORDER BY submitted_date DESC
    `)
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Database error' })
  }
})

// Create new appeal (protected)
app.post('/api/appeals', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { claimId, patient, amount, payer } = req.body
    
    const countResult = await pool.query('SELECT COUNT(*) FROM appeals')
    const count = parseInt(countResult.rows[0].count) + 1
    const newId = `APL-${String(count).padStart(3, '0')}`
    
    const result = await pool.query(
      `INSERT INTO appeals (id, claim_id, patient, amount, payer, submitted_date, status)
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, 'pending')
       RETURNING id, claim_id as "claimId", patient, amount, payer, submitted_date as "submittedDate", status, recovered_amount as "recoveredAmount"`,
      [newId, claimId, patient, amount, payer]
    )
    
    await pool.query('UPDATE claims SET status = $1 WHERE id = $2', ['appealed', claimId])
    
    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Database error' })
  }
})

// Update appeal status (protected)
app.patch('/api/appeals/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { status, recoveredAmount } = req.body
    const result = await pool.query(
      `UPDATE appeals SET status = $1, recovered_amount = $2 WHERE id = $3
       RETURNING id, claim_id as "claimId", patient, amount, payer, submitted_date as "submittedDate", status, recovered_amount as "recoveredAmount"`,
      [status, recoveredAmount, req.params.id]
    )
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Appeal not found' })
      return
    }
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Database error' })
  }
})

// Generate appeal letter (protected)
app.post('/api/appeals/generate', authenticateToken, (req: Request, res: Response) => {
  const { claim } = req.body
  
  const letter = `Dear Claims Review Department,

I am writing to formally appeal the denial of claim ${claim.id} for patient ${claim.patient}, dated ${claim.deniedDate}.

The claim in the amount of $${claim.amount} was denied for the following reason: "${claim.denialReason}".

After careful review of the patient's medical records and the applicable coverage guidelines, we believe this denial should be reconsidered for the following reasons:

1. The service provided was medically necessary based on the patient's documented condition and symptoms.

2. The treatment aligns with current clinical guidelines and standards of care for the patient's diagnosis.

3. All required documentation, including physician notes and diagnostic results, supports the medical necessity of this service.

We respectfully request that ${claim.payer} review this appeal and reverse the denial decision. Please find attached supporting documentation including physician notes, lab results, and relevant medical records.

Thank you for your prompt attention to this matter.

Sincerely,
ClaimRx Medical Billing
On behalf of ${claim.patient}`

  res.json({ letter })
})

// Dashboard stats (protected)
app.get('/api/stats', authenticateToken, async (_req: Request, res: Response) => {
  try {
    const claimsResult = await pool.query('SELECT SUM(amount) as total, COUNT(*) as count FROM claims')
    const appealsResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'approved') as approved,
        COUNT(*) FILTER (WHERE status = 'denied') as denied,
        COUNT(*) FILTER (WHERE status = 'pending' OR status = 'in-review') as pending,
        COALESCE(SUM(recovered_amount), 0) as recovered
      FROM appeals
    `)
    
    const totalDenied = parseInt(claimsResult.rows[0].total) || 0
    const totalClaims = parseInt(claimsResult.rows[0].count) || 0
    const approved = parseInt(appealsResult.rows[0].approved) || 0
    const denied = parseInt(appealsResult.rows[0].denied) || 0
    const totalRecovered = parseInt(appealsResult.rows[0].recovered) || 0
    const pendingAppeals = parseInt(appealsResult.rows[0].pending) || 0
    const totalAppeals = parseInt(appealsResult.rows[0].total) || 0
    
    const successRate = (approved + denied) > 0 
      ? Math.round((approved / (approved + denied)) * 100)
      : 0

    res.json({
      totalDenied,
      totalRecovered,
      successRate,
      pendingAppeals,
      totalClaims,
      totalAppeals
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Database error' })
  }
})

// Start server
app.listen(PORT, () => {
  console.log(`🚀 ClaimRx API running on http://localhost:${PORT}`)
})