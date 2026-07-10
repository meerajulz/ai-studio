"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Ellipsis, Pencil, Trash2 } from "lucide-react";

import type { Project } from "@/types/project";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ProjectCardProps = {
  project: Project;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
};

export function ProjectCard({ project, onEdit, onDelete }: ProjectCardProps) {
  return (
    <div className="relative">
      <Link href={`/projects/${project.id}`} className="block rounded-xl outline-none">
        <Card className="hover:border-ring h-full transition-colors">
          <CardHeader>
            <CardTitle className="truncate pr-8">{project.name}</CardTitle>
            <CardDescription className="line-clamp-2">
              {project.description || "No description"}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            Updated {formatDistanceToNow(project.updatedAt, { addSuffix: true })}
          </CardContent>
        </Card>
      </Link>

      <div className="absolute top-3 right-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Project actions"
            className="hover:bg-muted text-muted-foreground focus-visible:ring-ring/50 inline-flex size-7 items-center justify-center rounded-md outline-none focus-visible:ring-2"
          >
            <Ellipsis className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(project)}>
              <Pencil className="size-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(project)}
              className="text-destructive"
            >
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
