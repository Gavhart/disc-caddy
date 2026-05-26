import { useCallback, useEffect, useState } from 'react'
import { FriendHeadToHeadModal } from './FriendHeadToHeadModal'
import {
  listFriends,
  listIncomingFriendRequests,
  removeFriend,
  respondFriendRequest,
  sendFriendRequest,
} from '../lib/friends'
import { searchPlayers } from '../lib/rounds'
import { Friend, FriendRequest } from '../types'

export function FriendsSection() {
  const [friends, setFriends] = useState<Friend[]>([])
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<
    Awaited<ReturnType<typeof searchPlayers>>
  >([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [h2hFriend, setH2hFriend] = useState<Friend | null>(null)

  const reload = useCallback(async () => {
    setError(null)
    try {
      const [loadedFriends, loadedRequests] = await Promise.all([
        listFriends(),
        listIncomingFriendRequests(),
      ])
      setFriends(loadedFriends)
      setRequests(loadedRequests)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load friends')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  async function handleSearch(q: string) {
    setQuery(q)
    setOk(null)
    if (q.trim().length < 2) {
      setSearchResults([])
      return
    }
    try {
      setSearchResults(await searchPlayers(q))
    } catch (err) {
      console.error('[friends] search failed', err)
    }
  }

  async function handleSendRequest(userId: string) {
    setBusy(true)
    setError(null)
    setOk(null)
    try {
      await sendFriendRequest(userId)
      setOk('Friend request sent.')
      setQuery('')
      setSearchResults([])
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send request')
    } finally {
      setBusy(false)
    }
  }

  async function handleRespond(requestId: string, accept: boolean) {
    setBusy(true)
    setError(null)
    setOk(null)
    try {
      await respondFriendRequest(requestId, accept)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update request')
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(friend: Friend) {
    if (!confirm(`Remove ${friend.displayName} from your friends?`)) return
    setBusy(true)
    setError(null)
    try {
      await removeFriend(friend.userId)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove friend')
    } finally {
      setBusy(false)
    }
  }

  const friendIds = new Set(friends.map(f => f.userId))

  return (
    <div className="card friends-section">
      <h2>Friends</h2>
      <p className="muted small">
        Add friends for one-tap scorecard invites. When you&apos;re on a group
        card, everyone sees live scores and gets the round in their history.
      </p>

      {error && <div className="form-error">{error}</div>}
      {ok && <div className="form-success">{ok}</div>}

      {requests.length > 0 && (
        <div className="friends-requests">
          <h3 className="friends-subheading">Requests</h3>
          <ul className="friends-list">
            {requests.map(req => (
              <li key={req.id} className="friends-row">
                <div>
                  <strong>{req.displayName}</strong>
                  <span className="muted small"> · {req.email}</span>
                </div>
                <div className="friends-row-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={busy}
                    onClick={() => handleRespond(req.id, true)}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="link-button"
                    disabled={busy}
                    onClick={() => handleRespond(req.id, false)}
                  >
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <label className="friends-search">
        <span className="muted small">Add a friend by name or email</span>
        <input
          type="text"
          value={query}
          onChange={e => handleSearch(e.target.value)}
          placeholder="name or email@…"
          disabled={busy}
        />
      </label>

      {searchResults.length > 0 && (
        <ul className="friends-search-results">
          {searchResults.map(r => (
            <li key={r.userId}>
              {friendIds.has(r.userId) ? (
                <span className="muted small">
                  {r.displayName} · already friends
                </span>
              ) : (
                <button
                  type="button"
                  className="link-button"
                  disabled={busy}
                  onClick={() => handleSendRequest(r.userId)}
                >
                  {r.displayName}
                  <span className="muted small"> · {r.email}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <h3 className="friends-subheading">Your friends</h3>
      {loading ? (
        <p className="muted small">Loading…</p>
      ) : friends.length === 0 ? (
        <p className="muted small">No friends yet — search above to send a request.</p>
      ) : (
        <ul className="friends-list">
          {friends.map(friend => (
            <li key={friend.userId} className="friends-row">
              <div>
                <strong>{friend.displayName}</strong>
                <span className="muted small"> · {friend.email}</span>
              </div>
              <div className="friends-row-actions">
                <button
                  type="button"
                  className="link-button"
                  disabled={busy}
                  onClick={() => setH2hFriend(friend)}
                >
                  Compare stats
                </button>
                <button
                  type="button"
                  className="link-button danger"
                  disabled={busy}
                  onClick={() => handleRemove(friend)}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {h2hFriend && (
        <FriendHeadToHeadModal
          friendUserId={h2hFriend.userId}
          friendName={h2hFriend.displayName}
          onClose={() => setH2hFriend(null)}
        />
      )}
    </div>
  )
}
