/** Serializable project shape returned by the project server actions. */
export type Project = {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};
