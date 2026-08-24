"use client";

import { useEffect, useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMediaQuery } from "@/hooks/use-media-query";
import { DESK_BY_ID } from "@/lib/mock-data";
import { useWire } from "@/lib/store";
import { toast } from "@/hooks/use-toast";
import type { Dispatch } from "@/lib/types";
import { cn } from "@/lib/utils";

export function EditDraftSheet({
  dispatch,
  open,
  onOpenChange,
}: {
  dispatch: Dispatch | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const editDraft = useWire((state) => state.editDraft);
  const [body, setBody] = useState(dispatch?.body ?? "");

  useEffect(() => {
    if (open && dispatch) setBody(dispatch.body);
  }, [open, dispatch]);

  if (!dispatch) return null;

  const desk = DESK_BY_ID[dispatch.deskId];
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;
  const dirty = body !== dispatch.body;

  function save() {
    if (!dispatch) return;
    editDraft(dispatch.id, body.trim());
    onOpenChange(false);
    toast({
      title: "Copy revised",
      description: `Your edit is on the ${desk.tag.toLowerCase()} filing. It runs as written.`,
      variant: "success",
    });
  }

  const heading = (
    <>
      <span className="flex items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", desk.dot)} />
        <span className="font-mono text-2xs uppercase tracking-wire text-slate">
          {desk.tag} · {dispatch.kicker}
        </span>
      </span>
      <span className="mt-2 block font-display text-2xl font-semibold leading-snug tracking-tight text-ink">
        {dispatch.headline}
      </span>
    </>
  );

  const editor = (
    <div className="space-y-3 px-6 py-5">
      <div className="flex items-center justify-between">
        <Label htmlFor="draft-body">The filed copy</Label>
        <span className="font-mono text-2xs uppercase tracking-wire text-slate tabular-nums">
          {words} words
        </span>
      </div>
      <Textarea
        id="draft-body"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={14}
        className="min-h-[18rem] font-display text-base leading-relaxed"
      />
      <p className="font-mono text-2xs uppercase tracking-wire text-slate">
        House style: plain-spoken, specific, no hype. Edits are yours — the desk will not overwrite them.
      </p>
    </div>
  );

  const footer = (
    <>
      <Button
        variant="quiet"
        onClick={() => setBody(dispatch.body)}
        disabled={!dirty}
        className="sm:mr-auto"
      >
        <RotateCcw className="h-4 w-4" />
        Revert to the desk&apos;s draft
      </Button>
      <Button variant="outline" onClick={() => onOpenChange(false)}>
        Close without saving
      </Button>
      <Button onClick={save} disabled={!dirty}>
        <Save className="h-4 w-4" />
        Save the revision
      </Button>
    </>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle asChild>
              <div>{heading}</div>
            </DialogTitle>
            <DialogDescription>
              Filed {new Date(dispatch.filedAt).toLocaleString("en-GB")} · source: {dispatch.source}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto">{editor}</div>
          <DialogFooter>{footer}</DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle asChild>
            <div>{heading}</div>
          </DrawerTitle>
          <DrawerDescription>Source: {dispatch.source}</DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto">{editor}</div>
        <DrawerFooter>{footer}</DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
