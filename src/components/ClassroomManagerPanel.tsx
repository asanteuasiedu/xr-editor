import { useEffect, useMemo, useState } from 'react';
import type { CloudProject } from '../types/cloudProject';
import type { ProjectClassroom } from '../types/classroom';
import { getClassroomShareUrl } from '../utils/classroomLinks';
import {
  ClassroomsIcon,
  CloseIcon,
  CopyLinkIcon,
  LinkOffIcon,
  LinkOnIcon,
  RefreshIcon,
  TrashIcon
} from './icons';

type ClassroomManagerPanelProps = {
  project: CloudProject | null;
  classrooms: ProjectClassroom[];
  loading: boolean;
  error?: string | null;
  onClose: () => void;
  onCreateClassroom: (name: string, description?: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  onToggleActive: (classroomId: string, isActive: boolean) => Promise<void>;
  onDeleteClassroom: (classroomId: string) => Promise<void>;
};

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Recently';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

async function copyTextToClipboard(value: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  if (typeof document === 'undefined') {
    throw new Error('Clipboard access is unavailable.');
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

function ClassroomManagerPanel({
  project,
  classrooms,
  loading,
  error = null,
  onClose,
  onCreateClassroom,
  onRefresh,
  onToggleActive,
  onDeleteClassroom
}: ClassroomManagerPanelProps) {
  const genericCreateError =
    'Unable to create classroom. Confirm this project is saved to your account and the classroom database migration has been applied.';
  const [classroomName, setClassroomName] = useState('');
  const [classroomDescription, setClassroomDescription] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [createStatus, setCreateStatus] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [activeMutationId, setActiveMutationId] = useState<string | null>(null);

  useEffect(() => {
    if (!project) {
      setClassroomName('');
      setClassroomDescription('');
      setCreateError(null);
      setCreateStatus(null);
      setCopyStatus(null);
      setIsCreating(false);
      setActiveMutationId(null);
    }
  }, [project]);

  const sortedClassrooms = useMemo(
    () =>
      [...classrooms].sort((left, right) => {
        if (left.is_active !== right.is_active) {
          return left.is_active ? -1 : 1;
        }

        return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
      }),
    [classrooms]
  );

  if (!project) {
    return null;
  }

  return (
    <div
      className="auth-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`Manage classrooms for ${project.title || 'this project'}`}
      onClick={onClose}
    >
      <div className="auth-modal-card classroom-manager-panel" onClick={(event) => event.stopPropagation()}>
        <div className="auth-modal-header">
          <div className="auth-modal-heading">
            <p className="auth-modal-kicker">Classrooms</p>
            <h2>{project.title || 'Untitled XR Project'}</h2>
            <p className="auth-modal-copy">
              Create named classroom links for this experience and compare how each group engages with the same activity.
            </p>
          </div>
          <div className="auth-modal-actions-inline panel-header-actions">
            <button
              type="button"
              className="profile-icon-action"
              aria-label="Refresh classrooms"
              title="Refresh classrooms"
              onClick={() => {
                setCopyStatus(null);
                void onRefresh();
              }}
            >
              <RefreshIcon aria-hidden="true" />
            </button>
            <button
              type="button"
              className="profile-icon-action"
              aria-label="Close classroom manager"
              title="Close classroom manager"
              onClick={onClose}
            >
              <CloseIcon aria-hidden="true" />
            </button>
          </div>
        </div>

        <section className="classroom-manager-create">
          <div className="classroom-manager-create-heading">
            <div className="classroom-manager-create-icon" aria-hidden="true">
              <ClassroomsIcon />
            </div>
            <div>
              <h3>Create classroom link</h3>
              <p>Name the group the way you’ll want to compare it later in analytics.</p>
            </div>
          </div>
          <form
            className="classroom-manager-form"
            onSubmit={async (event) => {
              event.preventDefault();

              const trimmedName = classroomName.trim();
              if (!trimmedName || isCreating) {
                if (!trimmedName) {
                  setCreateError('Enter a classroom or group name first.');
                }
                return;
              }

              setCreateError(null);
              setCreateStatus(null);
              setCopyStatus(null);
              setIsCreating(true);

              try {
                await onCreateClassroom(trimmedName, classroomDescription.trim() || undefined);
                setClassroomName('');
                setClassroomDescription('');
                setCreateStatus(`Created "${trimmedName}" classroom link.`);
              } catch (createIssue) {
                const message =
                  createIssue instanceof Error && createIssue.message.trim()
                    ? createIssue.message
                    : genericCreateError;
                setCreateError(message);
              } finally {
                setIsCreating(false);
              }
            }}
          >
            <label className="auth-modal-field">
              <span>Classroom / Group Name</span>
              <input
                type="text"
                value={classroomName}
                onChange={(event) => setClassroomName(event.target.value)}
                placeholder="Period 1, Cohort B, Group A..."
                disabled={isCreating}
              />
            </label>
            <label className="auth-modal-field">
              <span>Description</span>
              <textarea
                value={classroomDescription}
                onChange={(event) => setClassroomDescription(event.target.value)}
                rows={3}
                placeholder="Optional notes for yourself"
                disabled={isCreating}
              />
            </label>
            <div className="auth-modal-actions">
              <button type="submit" className="ui-button ui-button-primary" disabled={isCreating || !classroomName.trim()}>
                {isCreating ? 'Creating classroom...' : 'Create Classroom'}
              </button>
            </div>
          </form>
          {createError ? (
            <p className="auth-modal-status auth-modal-status-error" role="status" aria-live="polite">
              {createError}
            </p>
          ) : null}
          {createStatus ? (
            <p className="auth-modal-status auth-modal-status-success" role="status" aria-live="polite">
              {createStatus}
            </p>
          ) : null}
          {copyStatus ? (
            <p className="auth-modal-status auth-modal-status-success" role="status" aria-live="polite">
              {copyStatus}
            </p>
          ) : null}
          {error ? (
            <p className="auth-modal-status auth-modal-status-error" role="status" aria-live="polite">
              {error}
            </p>
          ) : null}
        </section>

        <section className="classroom-manager-list-section">
          <div className="classroom-manager-list-header">
            <div>
              <p className="auth-modal-kicker">Share Links</p>
              <h3>Classroom links</h3>
            </div>
            <span className="profile-experience-count">{classrooms.length}</span>
          </div>

          {loading ? (
            <p className="auth-modal-status auth-modal-status-success" role="status" aria-live="polite">
              Loading classroom links...
            </p>
          ) : null}

          {!loading && sortedClassrooms.length === 0 ? (
            <div className="classroom-manager-empty-state">
              <h3>No classroom links yet.</h3>
              <p>Create a classroom link above to start tracking a specific group separately from general Explore traffic.</p>
            </div>
          ) : null}

          {!loading && sortedClassrooms.length > 0 ? (
            <div className="classroom-manager-list">
              {sortedClassrooms.map((classroom) => {
                const shareUrl = getClassroomShareUrl(classroom.share_slug);
                const isMutating = activeMutationId === classroom.id;

                return (
                  <article key={classroom.id} className="classroom-manager-row">
                    <div className="classroom-manager-row-copy">
                      <div className="classroom-manager-row-heading">
                        <strong>{classroom.name}</strong>
                        <span
                          className={`profile-experience-status profile-experience-status-${
                            classroom.is_active ? 'published' : 'draft'
                          }`}
                        >
                          {classroom.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      {classroom.description?.trim() ? <p>{classroom.description.trim()}</p> : null}
                      <code className="classroom-manager-share-url">{shareUrl}</code>
                      <span>Updated {formatDateTime(classroom.updated_at)}</span>
                    </div>
                    <div className="classroom-manager-row-actions">
                      <button
                        type="button"
                        className="profile-icon-action"
                        aria-label={`Copy ${classroom.name} link`}
                        title={`Copy ${classroom.name} link`}
                        onClick={async () => {
                          try {
                            await copyTextToClipboard(shareUrl);
                            setCopyStatus(`Copied ${classroom.name} link.`);
                          } catch (copyIssue) {
                            setCreateError(
                              copyIssue instanceof Error ? copyIssue.message : 'Could not copy the classroom link.'
                            );
                          }
                        }}
                      >
                        <CopyLinkIcon aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className={`profile-icon-action ${classroom.is_active ? '' : 'publish'}`}
                        aria-label={classroom.is_active ? 'Deactivate classroom link' : 'Activate classroom link'}
                        title={classroom.is_active ? 'Deactivate classroom link' : 'Activate classroom link'}
                        onClick={async () => {
                          setCreateError(null);
                          setCopyStatus(null);
                          setActiveMutationId(classroom.id);

                          try {
                            await onToggleActive(classroom.id, !classroom.is_active);
                          } catch (toggleIssue) {
                            setCreateError(
                              toggleIssue instanceof Error
                                ? toggleIssue.message
                                : 'Could not update the classroom link right now.'
                            );
                          } finally {
                            setActiveMutationId(null);
                          }
                        }}
                        disabled={isMutating}
                      >
                        {classroom.is_active ? <LinkOffIcon aria-hidden="true" /> : <LinkOnIcon aria-hidden="true" />}
                      </button>
                      <button
                        type="button"
                        className="profile-icon-action danger"
                        aria-label={`Delete ${classroom.name}`}
                        title={`Delete ${classroom.name}`}
                        onClick={async () => {
                          setCreateError(null);
                          setCopyStatus(null);
                          setActiveMutationId(classroom.id);

                          try {
                            await onDeleteClassroom(classroom.id);
                          } catch (deleteIssue) {
                            setCreateError(
                              deleteIssue instanceof Error
                                ? deleteIssue.message
                                : 'Could not delete the classroom link right now.'
                            );
                          } finally {
                            setActiveMutationId(null);
                          }
                        }}
                        disabled={isMutating}
                      >
                        <TrashIcon aria-hidden="true" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

export default ClassroomManagerPanel;
