export const claims = [
  {
    id: 'CLM-001',
    patient: 'John Smith',
    amount: 4500,
    payer: 'Blue Cross',
    denialReason: 'Medical necessity',
    deniedDate: '2026-01-15',
    deadline: '2026-03-15',
    status: 'pending'
  },
  {
    id: 'CLM-002',
    patient: 'Maria Garcia',
    amount: 2800,
    payer: 'Aetna',
    denialReason: 'Prior auth missing',
    deniedDate: '2026-01-18',
    deadline: '2026-03-18',
    status: 'in-progress'
  },
  {
    id: 'CLM-003',
    patient: 'Robert Johnson',
    amount: 8200,
    payer: 'UnitedHealth',
    denialReason: 'Coding error',
    deniedDate: '2026-01-20',
    deadline: '2026-03-20',
    status: 'pending'
  },
  {
    id: 'CLM-004',
    patient: 'Sarah Williams',
    amount: 3100,
    payer: 'Cigna',
    denialReason: 'Timely filing',
    deniedDate: '2026-01-22',
    deadline: '2026-02-22',
    status: 'urgent'
  },
  {
    id: 'CLM-005',
    patient: 'Michael Brown',
    amount: 5600,
    payer: 'Medicare',
    denialReason: 'Medical necessity',
    deniedDate: '2026-01-25',
    deadline: '2026-03-25',
    status: 'pending'
  }
]

export const appeals = [
  {
    id: 'APL-001',
    claimId: 'CLM-001',
    patient: 'John Smith',
    amount: 4500,
    payer: 'Blue Cross',
    submittedDate: '2026-01-20',
    status: 'approved',
    recoveredAmount: 4500
  },
  {
    id: 'APL-002',
    claimId: 'CLM-006',
    patient: 'Emily Davis',
    amount: 3200,
    payer: 'Aetna',
    submittedDate: '2026-01-22',
    status: 'pending',
    recoveredAmount: null
  },
  {
    id: 'APL-003',
    claimId: 'CLM-007',
    patient: 'James Wilson',
    amount: 6800,
    payer: 'UnitedHealth',
    submittedDate: '2026-01-25',
    status: 'in-review',
    recoveredAmount: null
  },
  {
    id: 'APL-004',
    claimId: 'CLM-008',
    patient: 'Lisa Anderson',
    amount: 2100,
    payer: 'Cigna',
    submittedDate: '2026-01-28',
    status: 'denied',
    recoveredAmount: 0
  },
  {
    id: 'APL-005',
    claimId: 'CLM-009',
    patient: 'David Martinez',
    amount: 5400,
    payer: 'Medicare',
    submittedDate: '2026-01-30',
    status: 'approved',
    recoveredAmount: 5400
  },
  {
    id: 'APL-006',
    claimId: 'CLM-010',
    patient: 'Jennifer Taylor',
    amount: 4100,
    payer: 'Blue Cross',
    submittedDate: '2026-02-01',
    status: 'pending',
    recoveredAmount: null
  }
]
