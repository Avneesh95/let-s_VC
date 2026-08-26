// Short, easy-to-read/share code — not cryptographically unique, just
// enough randomness that two people won't collide by accident in a demo.
export default function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/I/1, easy to read aloud
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
