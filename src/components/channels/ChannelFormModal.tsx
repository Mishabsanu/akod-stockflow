"use client";

import { Form, Formik } from "formik";
import { Store } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SelectField, STATUS_OPTIONS, TextAreaField, TextField } from "@/components/forms/FormikFields";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { Channel } from "@/lib/commerceTypes";
import { channelSchema, emptyChannel, type ChannelInput } from "@/lib/validation/channel.schema";
import { ApiError, resourceApi } from "@/services/apiClient";

const api = resourceApi<Channel>("/api/channels");

/** Create / edit a marketplace. `channel` = null → closed; "new" → create. */
export function ChannelFormModal({ channel, onClose }: { channel: Channel | "new" | null; onClose: () => void }) {
  const router = useRouter();
  if (!channel) return null;
  const editing = channel !== "new" ? channel : null;
  const initial: ChannelInput = editing
    ? { name: editing.name, code: editing.code, description: editing.description ?? "", status: editing.status }
    : emptyChannel;

  return (
    <Formik
      initialValues={initial}
      validationSchema={channelSchema}
      onSubmit={async (values, helpers) => {
        try {
          const saved = editing ? await api.update(editing._id, values) : await api.create(values);
          toast.success(editing ? "Marketplace updated" : `${saved.name} created`);
          onClose();
          if (!editing) router.push(`/dashboard/channels/${saved._id}`);
          router.refresh();
        } catch (e) {
          if (e instanceof ApiError && e.fieldErrors) helpers.setErrors(e.fieldErrors as never);
          toast.error(e instanceof ApiError ? e.message : "Could not save");
        } finally {
          helpers.setSubmitting(false);
        }
      }}
    >
      {({ isSubmitting, submitForm, setFieldValue, values, touched }) => (
        <Modal
          open
          onClose={onClose}
          title={editing ? "Edit Marketplace" : "New Marketplace"}
          subtitle="Amazon, Flipkart, Blinkit, BigBasket or any other channel you sell on"
          icon={<Store className="w-4 h-4" />}
          size="sm"
          footer={
            <>
              <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={submitForm} loading={isSubmitting}>
                {editing ? "Save Changes" : "Create Marketplace"}
              </Button>
            </>
          }
        >
          <Form noValidate className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField
              name="name"
              label="Channel Name"
              required
              placeholder="e.g. Amazon"
              autoFocus
              maxLength={80}
              onChange={(e) => {
                setFieldValue("name", e.target.value);
                // Suggest a code from the name until the user types one
                if (!editing && !touched.code) {
                  setFieldValue("code", e.target.value.toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 12));
                }
              }}
            />
            <TextField
              name="code"
              label="Channel Code"
              required
              placeholder="e.g. AMAZON"
              className="[&_input]:font-mono [&_input]:uppercase"
              hint={values.code ? undefined : "Unique"}
            />
            <TextAreaField name="description" label="Description" placeholder="Optional" className="sm:col-span-2" />
            <SelectField name="status" label="Status" required options={STATUS_OPTIONS} />
          </Form>
        </Modal>
      )}
    </Formik>
  );
}
