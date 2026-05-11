'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Volume, VolumePurpose, VolumeStorageType } from '@dillinger/shared';

type ManagedVolume = Volume & {
  friendlyName?: string;
  storageType?: VolumeStorageType;
};

type DetectedVolume = {
  mountPath: string;
  dockerVolumeName?: string;
  firstClassCategory: 'core' | 'roms' | 'cache' | 'installed' | null;
  purpose?: VolumePurpose;
};

type VolumeMetadataStore = {
  volumes: Record<string, { friendlyName?: string; storageType?: VolumeStorageType; purpose?: VolumePurpose }>;
};

type VolumeFormState = {
  id?: string;
  name: string;
  hostPath: string;
  pathKey: string;
  friendlyName: string;
  storageType: '' | VolumeStorageType;
  purpose: '' | VolumePurpose;
};

const emptyForm: VolumeFormState = {
  name: '',
  hostPath: '',
  pathKey: '',
  friendlyName: '',
  storageType: '',
  purpose: 'installed',
};

const PURPOSES: Array<{ value: '' | VolumePurpose; label: string }> = [
  { value: '', label: 'General' },
  { value: 'roms', label: 'ROM library' },
  { value: 'installed', label: 'Installed games' },
  { value: 'cache', label: 'Cache' },
  { value: 'downloads', label: 'Downloads' },
  { value: 'installers', label: 'Installers' },
];

const STORAGE_TYPES: Array<{ value: '' | VolumeStorageType; label: string }> = [
  { value: '', label: 'Storage type' },
  { value: 'ssd', label: 'SSD' },
  { value: 'platter', label: 'HDD' },
  { value: 'archive', label: 'Archive' },
];

function sanitizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function defaultNameFromPath(hostPath: string): string {
  const segment = hostPath.split('/').filter(Boolean).pop();
  return segment?.replace(/[_-]+/g, ' ') || 'volume';
}

function buildPathKey(name: string, purpose: '' | VolumePurpose): string {
  const slug = sanitizeSlug(name) || 'volume';
  if (purpose === 'installed') return `dillinger_installed_${slug}`;
  if (purpose === 'roms') return `dillinger_roms_${slug}`;
  return `dillinger_path_${slug}`;
}

function displayName(volume: ManagedVolume): string {
  return volume.friendlyName || volume.name || volume.dockerVolumeName;
}

export default function VolumesSettings() {
  const [managedVolumes, setManagedVolumes] = useState<ManagedVolume[]>([]);
  const [detectedVolumes, setDetectedVolumes] = useState<DetectedVolume[]>([]);
  const [metadata, setMetadata] = useState<VolumeMetadataStore>({ volumes: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<VolumeFormState>(emptyForm);

  async function loadVolumes() {
    setLoading(true);
    setError(null);
    try {
      const [managedResponse, metadataResponse, detectedResponse] = await Promise.all([
        fetch('/api/volumes'),
        fetch('/api/volumes/metadata'),
        fetch('/api/volumes/detected'),
      ]);

      const managedPayload = await managedResponse.json();
      const metadataPayload = await metadataResponse.json();
      const detectedPayload = await detectedResponse.json();
      const nextMetadata = metadataPayload.success ? metadataPayload.data as VolumeMetadataStore : { volumes: {} };

      const volumes = ((managedPayload.success ? managedPayload.data : []) as Volume[]).map((volume) => ({
        ...volume,
        friendlyName: nextMetadata.volumes[volume.hostPath]?.friendlyName,
        storageType: nextMetadata.volumes[volume.hostPath]?.storageType,
        purpose: volume.purpose ?? nextMetadata.volumes[volume.hostPath]?.purpose,
      }));

      setManagedVolumes(volumes);
      setMetadata(nextMetadata);
      setDetectedVolumes(detectedPayload.success ? detectedPayload.data?.volumes || [] : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load volumes');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVolumes();
  }, []);

  const detectedByPath = useMemo(
    () => new Map(detectedVolumes.map((volume) => [volume.mountPath, volume])),
    [detectedVolumes],
  );

  const romVolumes = managedVolumes.filter((volume) => volume.purpose === 'roms');
  const installedVolumes = managedVolumes.filter((volume) => volume.purpose === 'installed');
  function updateForm(patch: Partial<VolumeFormState>) {
    setForm((current) => {
      const next = { ...current, ...patch };
      if (patch.name !== undefined || patch.purpose !== undefined) {
        next.pathKey = buildPathKey(next.name, next.purpose);
      }
      return next;
    });
  }

  function startCreate(purpose: VolumePurpose = 'installed') {
    const next = { ...emptyForm, purpose };
    setForm({ ...next, pathKey: buildPathKey(next.name, purpose) });
    setMessage(null);
    setError(null);
  }

  function startEdit(volume: ManagedVolume) {
    const meta = metadata.volumes[volume.hostPath] ?? {};
    setForm({
      id: volume.id,
      name: volume.name,
      hostPath: volume.hostPath,
      pathKey: volume.dockerVolumeName,
      friendlyName: meta.friendlyName ?? volume.friendlyName ?? '',
      storageType: meta.storageType ?? volume.storageType ?? '',
      purpose: volume.purpose ?? meta.purpose ?? '',
    });
    setMessage(null);
    setError(null);
  }

  async function saveVolume(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (!form.name.trim() || !form.hostPath.trim()) {
        throw new Error('Name and host path are required.');
      }

      const payload = {
        name: form.name.trim(),
        hostPath: form.hostPath.trim(),
        dockerVolumeName: form.pathKey.trim() || buildPathKey(form.name, form.purpose),
        friendlyName: form.friendlyName.trim() || null,
        storageType: form.storageType || null,
        purpose: form.purpose || null,
        type: 'bind',
        linkExisting: true,
        status: 'active',
      };

      const response = await fetch(`/api/volumes${form.id ? `/${encodeURIComponent(form.id)}` : ''}`, {
        method: form.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to save volume');
      }

      setForm(emptyForm);
      setMessage(`${form.id ? 'Updated' : 'Registered'} ${payload.dockerVolumeName}`);
      await loadVolumes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save volume');
    } finally {
      setSaving(false);
    }
  }

  async function removeManagedRecord(volume: ManagedVolume) {
    if (!confirm(`Remove "${displayName(volume)}" from Dillinger path management? Files on disk will not be deleted.`)) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/volumes/${encodeURIComponent(volume.id)}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to remove volume');
      }
      setMessage(`Removed ${volume.dockerVolumeName}`);
      await loadVolumes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove volume');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="border border-border bg-surface/30 p-3">
          <div className="text-xs font-bold uppercase text-muted">ROM Libraries</div>
          <div className="mt-1 text-2xl font-bold text-text">{romVolumes.length}</div>
        </div>
        <div className="border border-border bg-surface/30 p-3">
          <div className="text-xs font-bold uppercase text-muted">Install Roots</div>
          <div className="mt-1 text-2xl font-bold text-text">{installedVolumes.length}</div>
        </div>
        <div className="border border-border bg-surface/30 p-3">
          <div className="text-xs font-bold uppercase text-muted">Managed Host Paths</div>
          <div className="mt-1 text-2xl font-bold text-text">{managedVolumes.length}</div>
        </div>
      </div>

      {(error || message) && (
        <div className={`border px-3 py-2 text-sm ${error ? 'border-error/40 bg-error/10 text-error' : 'border-success/40 bg-success/10 text-success'}`}>
          {error || message}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <section className="border border-border bg-surface/30">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h3 className="text-sm font-bold uppercase text-text">Managed Paths</h3>
                <p className="text-xs text-muted">Host paths registered here are available to ROM browsing, installer lookup, install selection, and runner bind mounts.</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => startCreate('roms')} className="border border-border px-3 py-1 text-xs font-bold text-text hover:bg-background">Add ROMs</button>
                <button type="button" onClick={() => startCreate('installed')} className="border border-border px-3 py-1 text-xs font-bold text-text hover:bg-background">Add Installed</button>
              </div>
            </div>
            {loading ? (
              <div className="p-4 text-sm text-muted">Loading volumes...</div>
            ) : managedVolumes.length === 0 ? (
              <div className="p-4 text-sm text-muted">No managed paths registered.</div>
            ) : (
              <div className="divide-y divide-border">
                {managedVolumes.map((volume) => {
                  const detected = detectedByPath.get(volume.hostPath);
                  return (
                    <div key={volume.id} className="grid gap-3 px-4 py-3 lg:grid-cols-[1fr_auto]">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-text">{displayName(volume)}</span>
                          <span className="border border-border px-2 py-0.5 text-[10px] uppercase text-muted">{volume.purpose || 'general'}</span>
                          {volume.storageType && <span className="border border-border px-2 py-0.5 text-[10px] uppercase text-muted">{volume.storageType}</span>}
                          <span className={`h-2 w-2 rounded-full ${detected ? 'bg-success' : 'bg-muted'}`} title={detected ? 'Detected by runtime' : 'Managed but not mounted in current runtime'} />
                        </div>
                        <div className="mt-1 truncate font-mono text-xs text-muted">{volume.hostPath}</div>
                        <div className="mt-1 truncate font-mono text-xs text-muted">{volume.dockerVolumeName}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => startEdit(volume)} className="border border-border px-3 py-1 text-xs font-bold text-text hover:bg-background">Edit</button>
                        <button type="button" onClick={() => removeManagedRecord(volume)} className="border border-error/40 px-3 py-1 text-xs font-bold text-error hover:bg-error/10">Remove</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <form onSubmit={saveVolume} className="h-fit border border-border bg-surface/30 p-4">
          <h3 className="text-sm font-bold uppercase text-text">{form.id ? 'Edit Managed Path' : 'Register Managed Path'}</h3>
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="text-xs font-bold uppercase text-muted">Purpose</span>
              <select value={form.purpose} onChange={(event) => updateForm({ purpose: event.target.value as VolumeFormState['purpose'] })} className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm text-text">
                {PURPOSES.map((purpose) => <option key={purpose.value || 'general'} value={purpose.value}>{purpose.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase text-muted">Name</span>
              <input
                value={form.name}
                onChange={(event) => updateForm({ name: event.target.value })}
                onBlur={() => {
                  if (!form.name.trim() && form.hostPath.trim()) updateForm({ name: defaultNameFromPath(form.hostPath) });
                }}
                className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm text-text"
                placeholder="fast ssd installs"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase text-muted">Host Path</span>
              <input
                value={form.hostPath}
                onChange={(event) => updateForm({ hostPath: event.target.value })}
                onBlur={() => {
                  if (!form.name.trim() && form.hostPath.trim()) updateForm({ name: defaultNameFromPath(form.hostPath) });
                }}
                className="mt-1 w-full border border-border bg-background px-3 py-2 font-mono text-sm text-text"
                placeholder="/mnt/games/installed"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase text-muted">Path Key</span>
              <input
                value={form.pathKey}
                onChange={(event) => updateForm({ pathKey: event.target.value })}
                className="mt-1 w-full border border-border bg-background px-3 py-2 font-mono text-sm text-text"
                placeholder={buildPathKey(form.name, form.purpose)}
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase text-muted">Friendly Label</span>
              <input value={form.friendlyName} onChange={(event) => updateForm({ friendlyName: event.target.value })} className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm text-text" />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase text-muted">Storage Type</span>
              <select value={form.storageType} onChange={(event) => updateForm({ storageType: event.target.value as VolumeFormState['storageType'] })} className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm text-text">
                {STORAGE_TYPES.map((type) => <option key={type.value || 'none'} value={type.value}>{type.label}</option>)}
              </select>
            </label>
            <div className="flex gap-2 pt-2">
              <button disabled={saving} type="submit" className="border border-primary bg-primary-soft px-3 py-2 text-xs font-bold uppercase text-primary disabled:opacity-50">
                {saving ? 'Saving...' : form.id ? 'Save Path' : 'Register Path'}
              </button>
              <button type="button" onClick={() => setForm(emptyForm)} className="border border-border px-3 py-2 text-xs font-bold uppercase text-muted hover:text-text">
                Clear
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
