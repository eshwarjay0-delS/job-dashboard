/**
 * Google Drive file operations — resumes live in each user's own Drive.
 * We only have `drive.file` scope: the app can only see files IT created.
 * All I/O goes through the user's refresh token stored in `user_drive`.
 */

const DRIVE_TOKEN_URL = "https://oauth2.googleapis.com/token"
const DRIVE_API = "https://www.googleapis.com/drive/v3"
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3"
const FOLDER_NAME = "MarketFit Resumes"

// ── Token refresh ────────────────────────────────────────────────────────────

export async function getAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch(DRIVE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  })
  if (!res.ok) throw new Error("Failed to refresh Google token")
  const data = await res.json()
  return data.access_token as string
}

// ── Folder management ────────────────────────────────────────────────────────

/** Find or create the "MarketFit Resumes" folder in the user's Drive. */
export async function ensureFolder(accessToken: string): Promise<string> {
  // Search for an existing folder first
  const q = encodeURIComponent(
    `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  )
  const search = await fetch(`${DRIVE_API}/files?q=${q}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const { files } = await search.json()
  if (files?.length > 0) return files[0].id as string

  // Create it
  const create = await fetch(`${DRIVE_API}/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    }),
  })
  if (!create.ok) throw new Error("Failed to create MarketFit Resumes folder in Drive")
  const folder = await create.json()
  return folder.id as string
}

// ── File operations ──────────────────────────────────────────────────────────

/** Upload a .docx buffer to the user's MarketFit Resumes folder. Returns the Drive file id. */
export async function uploadResume(
  accessToken: string,
  folderId: string,
  filename: string,
  buffer: Buffer
): Promise<string> {
  const metadata = JSON.stringify({ name: filename, parents: [folderId] })
  const body = new FormData()
  body.append("metadata", new Blob([metadata], { type: "application/json" }))
  body.append(
    "file",
    new Blob([buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    })
  )

  const res = await fetch(`${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body,
  })
  if (!res.ok) throw new Error("Failed to upload resume to Drive")
  const file = await res.json()
  return file.id as string
}

/** Download a file from Drive by its file id. Returns a Buffer. */
export async function downloadResume(
  accessToken: string,
  driveFileId: string
): Promise<Buffer> {
  const res = await fetch(`${DRIVE_API}/files/${driveFileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error("Failed to download resume from Drive")
  const ab = await res.arrayBuffer()
  return Buffer.from(ab)
}

/** Delete a file from Drive by its file id. */
export async function deleteResume(
  accessToken: string,
  driveFileId: string
): Promise<void> {
  await fetch(`${DRIVE_API}/files/${driveFileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

/** List all resume files in the user's MarketFit Resumes folder. */
export async function listResumes(
  accessToken: string,
  folderId: string
): Promise<Array<{ id: string; name: string; size: string }>> {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`)
  const res = await fetch(
    `${DRIVE_API}/files?q=${q}&fields=files(id,name,size)&orderBy=createdTime desc`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!res.ok) return []
  const { files } = await res.json()
  return files || []
}
