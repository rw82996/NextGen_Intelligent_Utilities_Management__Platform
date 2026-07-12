export async function POST(request: Request) {
  const { email, password } = await request.json();
  if (email === "daniel.osei@gridnextgen.io" && password === "demo1234") {
    return Response.json({
      user: { userId: "user-001", name: "Daniel Osei", email, role: "GRID_OPERATOR", orgId: "utility-001" },
      token: "demo-jwt-token",
    });
  }
  if (email === "maria.alvarez@gridnextgen.io" && password === "demo1234") {
    return Response.json({
      user: { userId: "user-002", name: "Maria Alvarez", email, role: "CONTROL_ROOM_LEAD", orgId: "utility-001" },
      token: "demo-jwt-token",
    });
  }
  return Response.json({ error: "Invalid credentials" }, { status: 401 });
}
