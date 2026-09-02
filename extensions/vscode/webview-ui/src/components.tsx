import React from 'react';
import type { Mismatch } from '../../src/api';

export const Button = ({ children, secondary, danger, onClick }: React.PropsWithChildren<{ secondary?: boolean; danger?: boolean; onClick(): void }>) => <button className={`button${secondary ? ' secondary' : ''}${danger ? ' danger' : ''}`} onClick={onClick}>{children}</button>;
export const StatusPill = ({ children, tone = '' }: React.PropsWithChildren<{ tone?: 'ok'|'warn'|'bad'|'' }>) => <span className={`pill ${tone}`}>{children}</span>;
export const EmptyState = ({ icon, title, detail, action, onAction }: { icon: string; title: string; detail: string; action: string; onAction(): void }) => <div className="empty"><div className="icon">{icon}</div><h3>{title}</h3><p className="muted">{detail}</p><Button onClick={onAction}>{action}</Button></div>;
export const DiffCard = ({ mismatch }: { mismatch: Mismatch }) => <div className="diff"><div className="remove">- database: {JSON.stringify(mismatch.dbValue ?? 'missing')}</div><div className="add">+ code: {JSON.stringify(mismatch.codeValue ?? mismatch.suggestedFix ?? 'review required')}</div></div>;
export const LockEstimateCard = ({ severity }: { severity: Mismatch['severity'] }) => <div className="row"><span>Estimated lock impact</span><StatusPill tone={severity === 'error' ? 'bad' : 'warn'}>{severity === 'error' ? 'Review required' : 'Low–medium'}</StatusPill></div>;
export const PipelineStepper = () => <div className="pipeline"><div className="stage current"><b>Development</b><div className="muted">Auto-applied</div></div><div className="stage"><b>Staging</b><div className="muted">Rehearsal gate</div></div><div className="stage"><b>Production</b><div className="muted">Approval required</div></div></div>;
