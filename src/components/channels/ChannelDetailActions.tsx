"use client";

import { Edit2, ListPlus, Power } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { Channel } from "@/lib/commerceTypes";
import { AssignProductsDrawer } from "./AssignProductsDrawer";
import { ChannelFormModal } from "./ChannelFormModal";
import { useToggleChannel } from "./ChannelListView";

/** Edit, activate / deactivate and Assign Products on the channel detail page (shown only with channel:update). */
export function ChannelDetailActions({ channel }: { channel: Channel }) {
  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const { toggle, busy } = useToggleChannel();
  const active = channel.status === "active";
  return (
    <>
      <Button variant="outline" onClick={() => setEditOpen(true)} icon={<Edit2 className="w-3.5 h-3.5" />}>
        Edit
      </Button>
      <Button variant="outline" onClick={() => toggle(channel)} loading={busy === channel._id} icon={<Power className="w-3.5 h-3.5" />}>
        {active ? "Deactivate" : "Activate"}
      </Button>
      <Button onClick={() => setAssignOpen(true)} icon={<ListPlus className="w-4 h-4" />}>
        Assign Products
      </Button>
      <ChannelFormModal channel={editOpen ? channel : null} onClose={() => setEditOpen(false)} />
      <AssignProductsDrawer channelId={channel._id} channelName={channel.name} open={assignOpen} onClose={() => setAssignOpen(false)} />
    </>
  );
}
