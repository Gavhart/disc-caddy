import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ProGate } from '../components/ProGate'
import { useAuth } from '../contexts/AuthContext'
import {
  buildCommunityThreads,
  countUnreadCommunityMessages,
  fetchCommunityMessages,
  formatCommunityMessageDay,
  formatCommunityMessageWhen,
  markCommunityMessageRead,
  sendCommunityMessage,
} from '../lib/community'
import { CommunityMessage } from '../types'

export function CommunityMessagesPage() {
  const { me } = useAuth()
  const navigate = useNavigate()
  const { partnerId } = useParams<{ partnerId?: string }>()
  const [messages, setMessages] = useState<CommunityMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [replyBody, setReplyBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  const loadMessages = useCallback(async () => {
    setError(null)
    try {
      const loaded = await fetchCommunityMessages()
      setMessages(loaded)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load messages')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadMessages()
  }, [loadMessages])

  const threads = useMemo(
    () => (me ? buildCommunityThreads(messages, me.id) : []),
    [messages, me],
  )

  const activeThread = useMemo(
    () => threads.find(t => t.partnerId === partnerId) ?? null,
    [threads, partnerId],
  )

  useEffect(() => {
    if (!activeThread || !me) return
    const unread = activeThread.messages.filter(m => m.isInbound && !m.readAt)
    if (unread.length === 0) return

    void (async () => {
      try {
        await Promise.all(unread.map(m => markCommunityMessageRead(m.id)))
        setMessages(prev =>
          prev.map(m =>
            unread.some(u => u.id === m.id)
              ? { ...m, readAt: m.readAt ?? new Date().toISOString() }
              : m,
          ),
        )
      } catch {
        // non-fatal
      }
    })()
  }, [activeThread, me])

  async function handleSendReply(e: FormEvent) {
    e.preventDefault()
    if (!activeThread || !me) return
    const text = replyBody.trim()
    if (!text) return

    setSending(true)
    setSendError(null)
    try {
      await sendCommunityMessage(activeThread.partnerId, text)
      setReplyBody('')
      await loadMessages()
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Could not send reply')
    } finally {
      setSending(false)
    }
  }

  if (!me) {
    return (
      <div className="container community-messages-page">
        <div className="card">
          <p className="muted">Loading…</p>
        </div>
      </div>
    )
  }

  const unreadTotal = countUnreadCommunityMessages(messages)
  const canStartNew = me.isPro && me.communityVisible && me.lookingForPlayers
  const canReplyInThread =
    me.isPro &&
    me.communityVisible &&
    (activeThread != null ? activeThread.messages.length > 0 : canStartNew)

  if (partnerId && !loading && !activeThread) {
    return (
      <div className="container community-messages-page">
        <div className="card">
          <p className="muted">Conversation not found.</p>
          <Link to="/community/messages" className="link-button">
            Back to messages
          </Link>
        </div>
      </div>
    )
  }

  if (partnerId && activeThread) {
    return (
      <div className="container community-messages-page community-messages-thread-view">
        <div className="community-thread-header card">
          <button
            type="button"
            className="link-button community-thread-back"
            onClick={() => navigate('/community/messages')}
          >
            ← Messages
          </button>
          <h1>{activeThread.partnerName}</h1>
          <p className="muted small">Community inbox · display names only</p>
        </div>

        <div className="community-thread card">
          <div className="community-thread-messages">
            {activeThread.messages.map((msg, index) => {
              const prev = activeThread.messages[index - 1]
              const showDay =
                !prev ||
                formatCommunityMessageDay(prev.createdAt) !==
                  formatCommunityMessageDay(msg.createdAt)
              const isMine = msg.senderId === me.id

              return (
                <div key={msg.id}>
                  {showDay && (
                    <p className="community-thread-day">{formatCommunityMessageDay(msg.createdAt)}</p>
                  )}
                  <div
                    className={
                      'community-thread-bubble' + (isMine ? ' community-thread-bubble-mine' : '')
                    }
                  >
                    <p className="community-thread-bubble-body">{msg.body}</p>
                    <p className="community-thread-bubble-time">
                      {formatCommunityMessageWhen(msg.createdAt)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          {canReplyInThread ? (
            <form className="community-thread-compose" onSubmit={handleSendReply}>
              <textarea
                value={replyBody}
                onChange={e => setReplyBody(e.target.value)}
                placeholder={`Reply to ${activeThread.partnerName.split(' ')[0]}…`}
                rows={3}
                maxLength={2000}
                disabled={sending}
              />
              {sendError && <div className="form-error">{sendError}</div>}
              <button
                type="submit"
                className="btn-primary"
                disabled={sending || !replyBody.trim()}
              >
                {sending ? 'Sending…' : 'Send reply'}
              </button>
            </form>
          ) : !me.isPro ? (
            <div className="community-thread-compose">
              <ProGate feature="Community messaging">
                {' '}
                You can still read messages here on the free plan.
              </ProGate>
            </div>
          ) : (
            <p className="community-thread-compose-hint muted small">
              Turn on Community on the{' '}
              <Link to="/community">Community page</Link> to reply.
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="container community-messages-page">
      <div className="card community-messages-header">
        <div className="community-messages-header-row">
          <h1>Messages</h1>
          {unreadTotal > 0 && (
            <span className="community-messages-unread-badge">{unreadTotal} new</span>
          )}
        </div>
        <p className="muted">
          {me.isPro
            ? 'Conversations with players in your home areas. Tap a thread to read and reply.'
            : 'Read messages from nearby players. Upgrade to Pro to send and reply.'}
        </p>
        <Link to="/community" className="link-button community-messages-settings-link">
          Community settings
        </Link>
      </div>

      {loading ? (
        <div className="card">
          <p className="muted">Loading…</p>
        </div>
      ) : error ? (
        <div className="card">
          <div className="form-error">{error}</div>
        </div>
      ) : threads.length === 0 ? (
        <div className="card">
          <p className="muted">No messages yet.</p>
          <p className="muted small">
            {me.isPro ? (
              <>
                Find players on the{' '}
                <Link to="/community">Community page</Link> and send your first message.
              </>
            ) : (
              <>
                When a Pro player messages you, it will show up here.{' '}
                <Link to="/upgrade">Upgrade to Pro</Link> to start conversations.
              </>
            )}
          </p>
        </div>
      ) : (
        <ul className="community-thread-list">
          {threads.map(thread => (
            <li key={thread.partnerId}>
              <Link
                to={`/community/messages/${thread.partnerId}`}
                className={
                  'community-thread-preview card' +
                  (thread.unreadCount > 0 ? ' community-thread-preview-unread' : '')
                }
              >
                <div className="community-thread-preview-top">
                  <p className="community-thread-preview-name">{thread.partnerName}</p>
                  <p className="community-thread-preview-time">
                    {formatCommunityMessageWhen(thread.lastMessage.createdAt)}
                  </p>
                </div>
                <p className="community-thread-preview-snippet">
                  {thread.lastMessage.senderId === me.id ? 'You: ' : ''}
                  {thread.lastMessage.body}
                </p>
                {thread.unreadCount > 0 && (
                  <span className="community-thread-preview-badge">
                    {thread.unreadCount} new
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
