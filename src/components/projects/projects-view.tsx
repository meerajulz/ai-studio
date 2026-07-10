"use client";

import { useState } from "react";
import { Folders, Plus } from "lucide-react";

import { useProjects } from "@/hooks/use-projects";
import type { Project } from "@/types/project";
import { PageContainer } from "@/components/shared/page-container";
import { SectionTitle } from "@/components/shared/section-title";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "./project-card";
import { ProjectFormDialog } from "./project-form-dialog";
import { DeleteProjectDialog } from "./delete-project-dialog";

export function ProjectsView() {
  const { data: projects, isLoading, isError, refetch } = useProjects();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(project: Project) {
    setEditing(project);
    setFormOpen(true);
  }

  return (
    <PageContainer>
      <SectionTitle
        title="Projects"
        description="Your workspaces for identity-based image and video generation."
        action={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            New project
          </Button>
        }
      />

      {isLoading ? (
        <LoadingState variant="grid" />
      ) : isError ? (
        <EmptyState
          title="Couldn't load projects"
          description="Something went wrong while loading your projects."
          action={
            <Button variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          }
        />
      ) : !projects || projects.length === 0 ? (
        <EmptyState
          icon={Folders}
          title="No projects yet"
          description="Create your first project to organize identities, uploads, and generations."
          action={
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              New project
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onEdit={openEdit}
              onDelete={setDeleting}
            />
          ))}
        </div>
      )}

      <ProjectFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        project={editing}
      />
      <DeleteProjectDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        project={deleting}
      />
    </PageContainer>
  );
}
