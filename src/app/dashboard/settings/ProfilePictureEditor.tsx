"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { UserAvatar } from "@/lib/ui/user-avatar";

function EditProfilePictureIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px]">
      <path
        d="M4 20h4l10-10-4-4L4 16v4zM13.8 6.2l4 4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

interface ProfilePictureEditorProps {
  name: string;
  initialAvatarUrl?: string | null;
}

export function ProfilePictureEditor({
  name,
  initialAvatarUrl = null,
}: ProfilePictureEditorProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [isUploading, setIsUploading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function handleUploadClick() {
    setMenuOpen(false);
    fileInputRef.current?.click();
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/auth/avatar", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        success?: boolean;
        data?: { avatarUrl?: string };
      };

      if (response.ok && payload.success && payload.data?.avatarUrl) {
        setAvatarUrl(payload.data.avatarUrl);
      }
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  return (
    <div className="relative mt-[10px] inline-block" ref={wrapperRef}>
      <UserAvatar size={240} name={name} imageUrl={avatarUrl} />

      <div className="absolute -bottom-[8px] left-[12px]">
        <button
          type="button"
          aria-label="Edit profile picture"
          aria-expanded={menuOpen}
          aria-controls="profile-picture-edit-menu"
          disabled={isUploading}
          onClick={() => setMenuOpen((open) => !open)}
          className="inline-flex items-center gap-[8px] rounded-[14px] border border-slate-700 bg-slate-950 px-[16px] py-[5px] text-[14px] font-medium leading-none text-slate-100 shadow-[0_10px_26px_rgba(0,0,0,0.45)] transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="text-slate-300">
            <EditProfilePictureIcon />
          </span>
          <span>Edit</span>
        </button>

        {menuOpen ? (
          <div
            id="profile-picture-edit-menu"
            role="menu"
            className="absolute left-[-12px] top-full z-30 mt-[10px] w-[240px] rounded-[16px] border border-slate-700 bg-slate-950 p-[12px] shadow-[0_16px_34px_rgba(0,0,0,0.55)]"
          >
            <button
              type="button"
              role="menuitem"
              onClick={handleUploadClick}
              disabled={isUploading}
              className="flex w-full items-center rounded-[12px] px-[16px] py-[5px] text-left text-[14px] font-normal text-slate-100 transition-colors hover:bg-slate-800/70"
            >
              {isUploading ? "Uploading..." : "Upload a photo..."}
            </button>
          </div>
        ) : null}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
