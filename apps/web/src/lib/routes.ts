interface ResourceRef {
  id: string;
  publicId?: string | null;
}

function resolveRouteId(resource: ResourceRef | string, publicId?: string | null) {
  if (typeof resource === "string") {
    return publicId || resource;
  }

  return resource.publicId || resource.id;
}

export function classPath(resource: ResourceRef | string, publicId?: string | null) {
  return `/c/${resolveRouteId(resource, publicId)}`;
}

export function classMembersPath(
  resource: ResourceRef | string,
  publicId?: string | null,
) {
  return `${classPath(resource, publicId)}/members`;
}

export function classSettingsPath(
  resource: ResourceRef | string,
  publicId?: string | null,
) {
  return `${classPath(resource, publicId)}/settings`;
}

export function taskPath(
  resource: ResourceRef | string,
  options?: { publicId?: string | null; section?: "attachments" | "discussion" },
) {
  const routeId = resolveRouteId(resource, options?.publicId);
  const base = `/t/${routeId}`;

  if (!options?.section) {
    return base;
  }

  return `${base}?section=${options.section}`;
}

export function taskEditPath(
  resource: ResourceRef | string,
  publicId?: string | null,
) {
  return `${taskPath(resource, { publicId })}/edit`;
}

export function taskSubmitPath(
  resource: ResourceRef | string,
  publicId?: string | null,
) {
  return `${taskPath(resource, { publicId })}/submit`;
}

export function taskSubmissionsPath(
  resource: ResourceRef | string,
  publicId?: string | null,
) {
  return `${taskPath(resource, { publicId })}/submissions`;
}

export function submissionPath(
  resource: ResourceRef | string,
  publicId?: string | null,
) {
  return `/s/${resolveRouteId(resource, publicId)}`;
}

export function joinClassPath(inviteCode: string) {
  return `/join/${encodeURIComponent(inviteCode)}`;
}
