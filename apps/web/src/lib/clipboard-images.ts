const CLIPBOARD_IMAGE_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/bmp": "bmp",
  "image/avif": "avif",
  "image/heic": "heic",
  "image/heif": "heif",
};

export function isImageFile(file: File) {
  return (
    file.type.toLowerCase().startsWith("image/") ||
    /\.(avif|bmp|gif|heic|heif|jpe?g|png|svg|webp)$/i.test(file.name)
  );
}

function normalizeClipboardImageFile(file: File, index: number) {
  const name = file.name.trim();
  if (name) {
    return file;
  }

  const type = file.type || "image/png";
  const ext = CLIPBOARD_IMAGE_EXTENSIONS[type.toLowerCase()] ?? "png";

  return new File([file], `clipboard-image-${Date.now()}-${index + 1}.${ext}`, {
    type,
    lastModified: file.lastModified || Date.now(),
  });
}

export function getClipboardImageFiles(data: DataTransfer) {
  const itemFiles = Array.from(data.items)
    .filter(
      (item) =>
        item.kind === "file" && item.type.toLowerCase().startsWith("image/"),
    )
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));

  const files =
    itemFiles.length > 0
      ? itemFiles
      : Array.from(data.files).filter(isImageFile);

  return files.map((file, index) => normalizeClipboardImageFile(file, index));
}
