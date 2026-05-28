// Shared data types for the Presales Tracker.

export interface Assessment {
  name: string;
  qb: string; // question-bank topics
}

export interface JdFile {
  name: string;
  size: number;
  type: string;
  // TODO(storage): currently a base64 data URL stored inline in the DB row.
  // When the storage provider is chosen, this becomes a URL into object
  // storage and uploads move out of the records table. See README.
  dataUrl: string;
}

/** A record as stored in / returned from the database. */
export interface PresalesRecord {
  id: string;
  person: string;
  customer: string;
  status: string;
  account: string;
  tara: string;
  notes: string;
  date: string; // kept as text ('YYYY-MM-DD' or '') to match flexible Excel imports
  assessments: Assessment[];
  jd_files: JdFile[];
  created_at?: string;
  updated_at?: string;
}

/** Payload shape for creating/updating a record (no server-managed fields). */
export type RecordInput = Omit<PresalesRecord, 'id' | 'created_at' | 'updated_at'>;
