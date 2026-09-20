import { get, del, head } from "@vercel/blob";

export function deriveBlobPathname(userId: string, uuid: string): string {
  return `pdfs/${userId}/${uuid}.pdf`;
}

export async function getPdfStream(pathname: string) {
  try {
    const result = await get(pathname, { access: 'private' });
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
