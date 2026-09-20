import { get, del, head } from "@vercel/blob";

export function deriveBlobPathname(userId: string, uuid: string): string {
  return `pdfs/${userId}/${uuid}.pdf`;
}

export function validateBlobPathname(pathname: string, expectedUserId: string): { valid: boolean; uuid: string | null } {
  // UUID v4 regex (lowercase only)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  
  const expectedPrefix = `pdfs/${expectedUserId}/`;
  if (!pathname.startsWith(expectedPrefix)) return { valid: false, uuid: null };
  if (!pathname.endsWith('.pdf')) return { valid: false, uuid: null };
  
  const uuid = pathname.slice(expectedPrefix.length, -4);
  if (!uuidRegex.test(uuid)) return { valid: false, uuid: null };
  
  return { valid: true, uuid };
}

export async function getPdfStream(pathname: string, options?: { useCache?: boolean }) {
  try {
    const result = await get(pathname, { access: 'private', ...options });
    return result;
  } catch (err: unknown) {
    console.error("Error fetching blob", pathname, err);
    return null;
  }
}

export async function deleteFile(pathname: string) {
  try {
    await del(pathname);
  } catch (err: unknown) {
    // Ignore not found errors for legacy rows
    console.error("Error deleting blob", pathname, err);
  }
}

export async function headFile(pathname: string) {
  try {
    return await head(pathname);
  } catch (err: unknown) {
    console.error("Error checking blob", pathname, err);
    return null;
  }
}
