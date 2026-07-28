export default function Sidebar({ users, activeUser, onSelect, onlineUsers, currentUser, onLogout }) {
  const userList = Array.isArray(users) ? users : [];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="me">{currentUser.username}</span>
        <button className="logout-btn" onClick={onLogout}>Log out</button>
      </div>
      <ul className="user-list">
        {userList.map((u) => (
          <li
            key={u._id}
            className={`user-item ${activeUser?._id === u._id ? "active" : ""}`}
            onClick={() => onSelect(u)}
          >
            <span
              className="avatar"
              style={{ backgroundColor: u.avatarColor }}
            >
              {u.username[0].toUpperCase()}
            </span>
            <span className="user-info">
              <span className="username">{u.username}</span>
              <span className={`status ${onlineUsers.includes(u._id) ? "online" : "offline"}`}>
                {onlineUsers.includes(u._id) ? "Online" : "Offline"}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
