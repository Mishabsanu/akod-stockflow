"use client";

import { Form, Formik } from "formik";
import { FormErrorNotice } from "@/components/forms/FormErrorNotice";
import { UserRound } from "lucide-react";
import { useState } from "react";
import { FormCard, FormSection } from "@/components/forms/FormCard";
import { SelectField, STATUS_OPTIONS, TextField } from "@/components/forms/FormikFields";
import { useSession } from "@/components/providers/SessionProvider";
import { useApiSubmit } from "@/hooks/useApiSubmit";
import type { Option } from "@/lib/types";
import { createUserSchema, emptyUser, MIN_PASSWORD_LENGTH, updateUserSchema, type UserInput } from "@/lib/validation/user.schema";
import type { UserRecord } from "@/server/services/user.service";
import { resourceApi } from "@/services/apiClient";
import { PasswordField } from "./PasswordField";
import { USER_UI } from "./userConfig";

const api = resourceApi<UserRecord>(USER_UI.apiBase);

interface UserFormProps {
  initial?: UserRecord;
  roleOptions: Option[];
}

export function UserForm({ initial, roleOptions }: UserFormProps) {
  const session = useSession();
  const [showPassword, setShowPassword] = useState(false);
  const isEdit = Boolean(initial);
  const isSelf = initial?._id === session._id;

  const initialValues: UserInput = initial
    ? {
        name: initial.name,
        email: initial.email,
        mobile: initial.mobile,
        role: initial.role?._id ?? "",
        status: initial.status,
        password: "",
        confirmPassword: "",
      }
    : emptyUser;

  const onSubmit = useApiSubmit<UserInput, UserRecord>({
    request: (values) => (initial ? api.update(initial._id, values) : api.create(values)),
    successMessage: isEdit ? "User updated" : "User created",
    redirectTo: USER_UI.basePath,
  });

  const toggle = () => setShowPassword((v) => !v);

  return (
    <Formik initialValues={initialValues} validationSchema={isEdit ? updateUserSchema : createUserSchema} onSubmit={onSubmit}>
      {({ isSubmitting }) => (
        <Form noValidate>
          <FormErrorNotice />
          <FormCard
            title={isEdit ? "Edit User" : "Create New User"}
            description={USER_UI.description}
            badge={isEdit ? initial?.email : "New Record"}
            icon={<UserRound className="w-4.5 h-4.5" />}
            backHref={USER_UI.basePath}
            submitLabel="Save User"
            submitting={isSubmitting}
          >
            <FormSection title="Account">
              <TextField name="name" label="Full Name" required placeholder="e.g. Ahmed Al Mansoori" maxLength={100} />
              <TextField name="email" label="Email" type="email" required placeholder="name@company.com" autoComplete="off" />
              <TextField name="mobile" label="Mobile" required placeholder="+91 98765 43210" />
              <SelectField
                name="role"
                label="Role"
                required
                placeholder="Select a role"
                options={roleOptions}
                disabled={isSelf}
                hint={isSelf ? "You cannot change your own role" : undefined}
              />
              <SelectField
                name="status"
                label="Status"
                required
                options={STATUS_OPTIONS}
                disabled={isSelf}
                hint={isSelf ? "You cannot deactivate yourself" : undefined}
              />
            </FormSection>

            <FormSection
              title="Password"
              description={
                isEdit
                  ? "Leave blank to keep current password"
                  : `At least ${MIN_PASSWORD_LENGTH} characters, with a letter and a number`
              }
            >
              <PasswordField
                name="password"
                label={isEdit ? "New Password" : "Password"}
                required={!isEdit}
                hint={isEdit ? "Leave blank to keep current password" : undefined}
                autoComplete="new-password"
                visible={showPassword}
                onToggle={toggle}
              />
              <PasswordField
                name="confirmPassword"
                label="Confirm Password"
                required={!isEdit}
                autoComplete="new-password"
                visible={showPassword}
                onToggle={toggle}
              />
            </FormSection>
          </FormCard>
        </Form>
      )}
    </Formik>
  );
}
