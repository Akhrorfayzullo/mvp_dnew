import mongoose, { Schema } from 'mongoose'

// Content model
const contentSchema = new Schema({
  org_id: { type: String, required: true, index: true },
  type: {
    type: String,
    enum: ['blog', 'instagram', 'banner', 'faq', 'sms', 'compliance_check'],
    required: true,
  },
  title: String,
  body: String,
  images: [String],
  tags: [String],
  compliance_score: Number,
  status: { type: String, enum: ['draft', 'approved', 'published'], default: 'draft' },
  metadata: Schema.Types.Mixed,
  created_at: { type: Date, default: Date.now },
})

// Audit log model
const auditLogSchema = new Schema({
  user_id: { type: String, required: true },
  action: { type: String, required: true },
  details: Schema.Types.Mixed,
  created_at: { type: Date, default: Date.now },
})

export const Content = mongoose.models.Content || mongoose.model('Content', contentSchema)
export const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema)
