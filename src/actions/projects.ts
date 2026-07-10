"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { projectInputSchema, type ProjectInput } from "@/lib/validations/project";

/** Resolve the current user id or throw — every action is scoped to the owner. */
async function requireUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

const projectSelect = {
  id: true,
  name: true,
  description: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function listProjects() {
  const userId = await requireUserId();
  return prisma.project.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: projectSelect,
  });
}

export async function createProject(input: ProjectInput) {
  const userId = await requireUserId();
  const data = projectInputSchema.parse(input);

  return prisma.project.create({
    data: {
      userId,
      name: data.name,
      description: data.description || null,
    },
    select: projectSelect,
  });
}

export async function updateProject(id: string, input: ProjectInput) {
  const userId = await requireUserId();
  const data = projectInputSchema.parse(input);

  // updateMany scopes by userId so users can only edit their own projects.
  const result = await prisma.project.updateMany({
    where: { id, userId },
    data: { name: data.name, description: data.description || null },
  });
  if (result.count === 0) {
    throw new Error("Project not found");
  }

  return prisma.project.findFirstOrThrow({
    where: { id, userId },
    select: projectSelect,
  });
}

export async function deleteProject(id: string) {
  const userId = await requireUserId();
  const result = await prisma.project.deleteMany({ where: { id, userId } });
  if (result.count === 0) {
    throw new Error("Project not found");
  }
  return { id };
}
