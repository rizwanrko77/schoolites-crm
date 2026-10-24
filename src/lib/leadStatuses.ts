export interface LeadStatusConfig {
  id: string;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  description?: string;
  isClosed?: boolean;
}

export const LEAD_STATUSES: LeadStatusConfig[] = [
  {
    id: 'unassigned',
    label: 'Unassigned Pool',
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
    description: 'Fresh lead awaiting claim or assignment to a Lead Manager',
  },
  {
    id: 'assigned',
    label: 'Assigned',
    color: '#38bdf8',
    bgColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: 'rgba(56, 189, 248, 0.35)',
    description: 'Assigned to a Lead Manager; discovery and initial contact pending',
  },
  {
    id: 'demo_scheduled',
    label: 'Demo Scheduled',
    color: '#06b6d4',
    bgColor: 'rgba(6, 182, 212, 0.15)',
    borderColor: 'rgba(6, 182, 212, 0.35)',
    description: 'Product demonstration slot booked with school stakeholders',
  },
  {
    id: 'demo_completed',
    label: 'Demo Completed',
    color: '#14b8a6',
    bgColor: 'rgba(20, 184, 166, 0.15)',
    borderColor: 'rgba(20, 184, 166, 0.35)',
    description: 'Product walk-through delivered; gathering school feedback and requirements',
  },
  {
    id: 'in_discussion',
    label: 'In Discussion',
    color: '#818cf8',
    bgColor: 'rgba(129, 140, 248, 0.15)',
    borderColor: 'rgba(129, 140, 248, 0.35)',
    description: 'Active commercial discussions, module customizations, and evaluation',
  },
  {
    id: 'following_up',
    label: 'Following Up',
    color: '#a855f7',
    bgColor: 'rgba(168, 85, 247, 0.15)',
    borderColor: 'rgba(168, 85, 247, 0.35)',
    description: 'Nurturing stakeholder interest and addressing committee queries',
  },
  {
    id: 'proposal_sent',
    label: 'Proposal Sent',
    color: '#c084fc',
    bgColor: 'rgba(192, 132, 252, 0.15)',
    borderColor: 'rgba(192, 132, 252, 0.35)',
    description: 'Commercial proposal or quote submitted; awaiting institutional approval',
  },
  {
    id: 'onboarding_initiated',
    label: 'Onboarding Initiated',
    color: '#ec4899',
    bgColor: 'rgba(236, 72, 153, 0.15)',
    borderColor: 'rgba(236, 72, 153, 0.35)',
    description: 'Agreement approved; school data collection and configuration started',
  },
  {
    id: 'onboarding_completed',
    label: 'Onboarding Completed',
    color: '#10b981',
    bgColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
    description: 'School staff trained, system live, and platform handover complete',
  },
  {
    id: 'won',
    label: 'Won 🏆',
    color: '#34d399',
    bgColor: 'rgba(52, 211, 153, 0.15)',
    borderColor: 'rgba(52, 211, 153, 0.35)',
    description: 'Contract signed and deal won; commission settlement queued',
    isClosed: true,
  },
  {
    id: 'lost',
    label: 'Lost',
    color: '#f87171',
    bgColor: 'rgba(248, 113, 113, 0.15)',
    borderColor: 'rgba(248, 113, 113, 0.35)',
    description: 'Lead disqualified, postponed, or lost to competitor',
    isClosed: true,
  },
];

export const ALL_STATUS_IDS = LEAD_STATUSES.map((s) => s.id);

export const STATUS_COLOR_MAP: Record<string, string> = LEAD_STATUSES.reduce((acc, st) => {
  acc[st.id] = st.color;
  return acc;
}, {} as Record<string, string>);

export function getStatusMeta(statusId?: string | null): LeadStatusConfig {
  const normalized = (statusId || '').toLowerCase().trim();
  const found = LEAD_STATUSES.find((s) => s.id === normalized);
  if (found) return found;

  const formattedLabel = (statusId || 'Unknown').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    id: statusId || 'unknown',
    label: formattedLabel,
    color: '#94a3b8',
    bgColor: 'rgba(148, 163, 184, 0.15)',
    borderColor: 'rgba(148, 163, 184, 0.35)',
  };
}
