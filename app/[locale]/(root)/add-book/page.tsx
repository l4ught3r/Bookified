"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  FileText,
  Image as ImageIcon,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { AuthSignInPrompt } from "@/components/auth/clerk-auth";
import { BookFormatBadge } from "@/components/bookified/book-format-badge";
import { TopNavbar } from "@/components/bookified/top-navbar";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { detectFormatFromFile, validateBookUploadFile } from "@/lib/books/book-formats";
import { libraryBookFromApiPayload } from "@/lib/books/library-offline";
import { uploadBookWithProgress } from "@/lib/books/upload-book-client";
import { useRouter } from "@/lib/i18n/navigation";
import { useBookStore } from "@/lib/store/useBookStore";
import { cn } from "@/lib/utils";

type UploadStatus = "idle" | "uploading" | "processing" | "success" | "error" | "duplicate";

type DuplicateBookInfo = {
  _id: string;
  title: string;
  authors: string[];
  format?: string;
};

export default function AddBookPage() {
  const t = useTranslations("addBook");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [bookMetadata, setBookMetadata] = useState({
    title: "",
    author: "",
    description: "",
    cover: "",
  });
  const [createdBookId, setCreatedBookId] = useState<string | null>(null);
  const [duplicateBook, setDuplicateBook] = useState<DuplicateBookInfo | null>(null);
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(null);
  const [showManualMetadata, setShowManualMetadata] = useState(false);
  const [manualMetadataOverride, setManualMetadataOverride] = useState(false);
  const metadataCollapseRef = useRef<HTMLDivElement>(null);
  const mainScrollRef = useRef<HTMLElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const bookFileInputRef = useRef<HTMLInputElement>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);

  const suggestedTitleFromFile = selectedFile
    ? selectedFile.name.replace(/\.(pdf|epub|txt|fb2)$/i, "").replace(/[-_]/g, " ")
    : "";

  const toggleManualMetadata = useCallback(() => {
    setShowManualMetadata((prev) => {
      if (!prev) {
        setManualMetadataOverride(true);
        return true;
      }

      const node = metadataCollapseRef.current;
      const scrollContainer = mainScrollRef.current;
      if (node && scrollContainer) {
        const scrollTop = scrollContainer.scrollTop;
        const height = node.offsetHeight;
        const top =
          node.getBoundingClientRect().top -
          scrollContainer.getBoundingClientRect().top +
          scrollTop;

        if (height > 0 && scrollTop > top) {
          scrollContainer.scrollTo({
            top: Math.max(0, scrollTop - height),
            behavior: "instant",
          });
        }
      }

      return false;
    });
  }, []);

  const detectedFormat = selectedFile ? detectFormatFromFile(selectedFile) : null;

  useEffect(() => {
    return () => {
      if (coverPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(coverPreviewUrl);
      }
    };
  }, [coverPreviewUrl]);

  const updateCoverPreview = useCallback((nextPreview: string | null, revokePrevious = true) => {
    setCoverPreviewUrl((current) => {
      if (revokePrevious && current?.startsWith("blob:") && current !== nextPreview) {
        URL.revokeObjectURL(current);
      }
      return nextPreview;
    });
  }, []);

  const showErrorToast = useCallback((title: string, description?: string) => {
    toast({
      variant: "destructive",
      title,
      description,
      duration: 5000,
    });
  }, []);

  const handleCoverFileSelect = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) {
        showErrorToast(t("coverInvalidFormat"), t("coverInvalidFormatDescription"));
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        showErrorToast(t("coverTooLarge"), t("coverTooLargeDescription"));
        return;
      }

      setCoverFile(file);
      setBookMetadata((prev) => ({ ...prev, cover: "" }));
      updateCoverPreview(URL.createObjectURL(file));
    },
    [showErrorToast, t, updateCoverPreview],
  );

  const clearCover = useCallback(() => {
    setCoverFile(null);
    setBookMetadata((prev) => ({ ...prev, cover: "" }));
    updateCoverPreview(null);
    if (coverInputRef.current) {
      coverInputRef.current.value = "";
    }
  }, [updateCoverPreview]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleFileSelect = useCallback(
    (file: File) => {
      const validation = validateBookUploadFile(file);
      if (!validation.ok) {
        showErrorToast(t("fileRejected"), validation.message);
        return;
      }

      setSelectedFile(file);
      setUploadErrorMessage(null);
    },
    [showErrorToast, t],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files?.[0]) {
        handleFileSelect(e.dataTransfer.files[0]);
      }
    },
    [handleFileSelect],
  );

  const handleSubmit = async () => {
    if (!selectedFile) return;

    if (!isAuthLoaded) {
      return;
    }

    if (!isSignedIn) {
      showErrorToast(tCommon("signInRequired"), t("signInPrompt"));
      return;
    }

    if (!detectedFormat) {
      showErrorToast(t("formatDetectFailed"), t("formatDetectFailedDescription"));
      return;
    }

    try {
      setCreatedBookId(null);
      setUploadErrorMessage(null);
      setUploadStatus("uploading");
      setUploadProgress(0);

      const formData = new FormData();
      formData.append("file", selectedFile);

      if (coverFile) {
        formData.append("cover", coverFile);
      } else if (bookMetadata.cover.trim()) {
        formData.append("coverUrl", bookMetadata.cover.trim());
      }

      if (manualMetadataOverride) {
        if (bookMetadata.title.trim()) {
          formData.append("title", bookMetadata.title.trim());
        }
        if (bookMetadata.author.trim()) {
          formData.append("author", bookMetadata.author.trim());
        }
        if (bookMetadata.description.trim()) {
          formData.append("description", bookMetadata.description.trim());
        }
      }

      const { status, json } = await uploadBookWithProgress(formData, ({ progress, phase }) => {
        setUploadProgress(progress);
        setUploadStatus(phase);
      });

      if (status === 401) {
        showErrorToast(tCommon("signInRequired"), json.message || t("signInPrompt"));
        setUploadStatus("idle");
        setUploadProgress(0);
        return;
      }

      if (status === 409 && json.error === "duplicate") {
        const duplicate =
          json.book?._id && json.book.title
            ? ({
                _id: String(json.book._id),
                title: json.book.title,
                authors: json.book.authors ?? [],
                format: json.book.format,
              } satisfies DuplicateBookInfo)
            : null;
        setDuplicateBook(duplicate);
        setUploadStatus("duplicate");
        setUploadProgress(0);
        return;
      }

      if (status < 200 || status >= 300) {
        throw new Error(json.details || json.message || json.error || "Upload failed");
      }

      const bookId = json.book?._id ? String(json.book._id) : undefined;
      if (bookId) setCreatedBookId(bookId);

      const libraryBook = libraryBookFromApiPayload(json.book ?? {});
      if (libraryBook) {
        await useBookStore.getState().addLibraryBook(libraryBook);
      }

      setUploadProgress(100);
      setUploadStatus("success");
    } catch (e) {
      console.error(e);
      const message = e instanceof Error ? e.message : t("uploadFailed");
      setUploadErrorMessage(message);
      setUploadStatus("error");
      setUploadProgress(0);
    }
  };

  const resetForm = () => {
    setUploadStatus("idle");
    setUploadProgress(0);
    setSelectedFile(null);
    setBookMetadata({ title: "", author: "", description: "", cover: "" });
    setCoverFile(null);
    updateCoverPreview(null);
    if (coverInputRef.current) {
      coverInputRef.current.value = "";
    }
    setCreatedBookId(null);
    setDuplicateBook(null);
    setUploadErrorMessage(null);
    setShowManualMetadata(false);
    setManualMetadataOverride(false);
  };

  const dismissDuplicate = () => {
    setUploadStatus("idle");
    setUploadProgress(0);
    setDuplicateBook(null);
  };

  const isUploading = uploadStatus === "uploading" || uploadStatus === "processing";

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <TopNavbar />

      <AnimatedOverlay
        open={isUploading}
        labelledBy="upload-dialog-title"
        describedBy="upload-dialog-description"
        panelClassName="rounded-2xl border border-border/50 bg-card p-6 shadow-xl sm:p-8"
      >
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          {uploadStatus === "uploading" ? (
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          ) : (
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          )}
        </div>

        <h2 id="upload-dialog-title" className="text-center text-xl font-semibold tracking-tight">
          {uploadStatus === "uploading" ? t("uploadSendingTitle") : t("uploadPreparingTitle")}
        </h2>
        <p
          id="upload-dialog-description"
          className="mt-2 text-center text-sm text-muted-foreground"
        >
          {uploadStatus === "uploading"
            ? t("uploadSendingDescription")
            : t("uploadPreparingDescription")}
        </p>

        <Progress
          value={uploadProgress}
          className="mt-6 h-2"
          aria-labelledby="upload-dialog-description"
        />

        <p className="mt-3 text-center text-xs tabular-nums text-muted-foreground">
          {uploadStatus === "processing"
            ? t("uploadProgressProcessing")
            : t("uploadProgressSending", { progress: uploadProgress })}
        </p>

        {selectedFile ? (
          <div className="mt-5 rounded-xl bg-secondary/50 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
              {detectedFormat ? <BookFormatBadge format={detectedFormat} size="md" /> : null}
            </div>
          </div>
        ) : null}
      </AnimatedOverlay>

      <AnimatedOverlay
        open={uploadStatus === "duplicate"}
        labelledBy="duplicate-dialog-title"
        panelClassName="rounded-2xl border border-border/50 bg-card p-6 shadow-xl sm:p-8"
        onEscape={dismissDuplicate}
      >
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
          <BookOpen className="h-7 w-7 text-primary" />
        </div>

        <h2
          id="duplicate-dialog-title"
          className="text-center text-xl font-semibold tracking-tight"
        >
          {t("duplicateTitle")}
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {t("duplicateExtendedDescription")}
        </p>

        {duplicateBook ? (
          <div className="mt-5 rounded-xl bg-secondary/50 px-4 py-3 text-center">
            <p className="font-medium">{duplicateBook.title}</p>
            {duplicateBook.authors?.length ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {duplicateBook.authors.join(", ")}
              </p>
            ) : null}
            {duplicateBook.format ? (
              <div className="mt-3 flex justify-center">
                <BookFormatBadge format={duplicateBook.format} size="md" />
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={dismissDuplicate} className="flex-1 rounded-xl">
            {tCommon("cancel")}
          </Button>
          {duplicateBook?._id ? (
            <Button
              className="flex-1 rounded-xl bg-primary text-primary-foreground"
              onClick={() => router.push(`/reader/${duplicateBook._id}`)}
            >
              {t("openDuplicateBook")}
            </Button>
          ) : (
            <Button
              className="flex-1 rounded-xl bg-primary text-primary-foreground"
              onClick={() => router.push("/library")}
            >
              {t("goToLibrary")}
            </Button>
          )}
        </div>
      </AnimatedOverlay>

      <main
        id="main-content"
        ref={mainScrollRef}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain px-3 py-5 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:px-4 sm:py-6 md:px-8 lg:px-12 lg:pb-6 lg:[scrollbar-gutter:stable]"
      >
        <div className="mx-auto w-full min-w-0 max-w-3xl">
          {/* Header */}
          <div className="mb-6 text-center sm:mb-8">
            <h1 className="type-page-title">{t("title")}</h1>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">{t("pageSubtitle")}</p>
          </div>

          {uploadStatus === "success" ? (
            <div className="animate-in fade-in rounded-2xl bg-card p-6 text-center shadow-sm duration-300 sm:p-8">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/15">
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
              <h2 className="text-xl font-semibold">{t("success")}</h2>
              <p className="mt-2 text-muted-foreground">{t("successReadyDescription")}</p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Button variant="outline" onClick={resetForm} className="rounded-xl">
                  {t("addAnother")}
                </Button>
                <Button
                  className="rounded-xl bg-primary text-primary-foreground"
                  onClick={() =>
                    router.push(createdBookId ? `/reader/${createdBookId}` : "/library")
                  }
                >
                  {createdBookId ? t("openInReader") : t("openLibrary")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="animate-in fade-in space-y-4 duration-300 sm:space-y-6">
              <div className="rounded-2xl bg-card p-4 shadow-sm sm:p-6">
                <input
                  ref={bookFileInputRef}
                  id="book-file-upload"
                  type="file"
                  className="sr-only"
                  accept=".pdf,.epub,.txt,.fb2,.fb2.zip"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                    e.target.value = "";
                  }}
                />
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`relative flex min-h-[180px] flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors sm:min-h-[200px] ${
                    dragActive
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  {selectedFile ? (
                    <div className="flex w-full max-w-full flex-col items-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                        <FileText className="h-6 w-6 text-primary" aria-hidden />
                      </div>
                      <p className="max-w-full truncate px-2 font-medium">{selectedFile.name}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <p className="text-sm text-muted-foreground">
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                        {detectedFormat ? (
                          <BookFormatBadge format={detectedFormat} size="md" />
                        ) : null}
                      </div>
                      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11 rounded-lg"
                          onClick={() => bookFileInputRef.current?.click()}
                        >
                          {t("changeFile")}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="min-h-11 text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            setSelectedFile(null);
                            if (bookFileInputRef.current) {
                              bookFileInputRef.current.value = "";
                            }
                          }}
                        >
                          <X className="mr-1 h-4 w-4" aria-hidden />
                          {t("removeSelectedFile")}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload className="mb-4 h-10 w-10 text-muted-foreground" aria-hidden />
                      <p className="mb-1 font-medium">
                        {t("dragDrop")}{" "}
                        <label
                          htmlFor="book-file-upload"
                          className="cursor-pointer text-primary hover:underline"
                        >
                          {t("chooseFile")}
                        </label>
                      </p>
                      <p className="text-sm text-muted-foreground">{t("formatsHint")}</p>
                    </>
                  )}
                </div>
              </div>

              {/* Metadata form */}
              <div className="rounded-2xl bg-card p-4 shadow-sm sm:p-6">
                <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:text-left">
                  <div className="flex flex-col items-center gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                      <h2 className="text-base font-semibold">{t("metadataTitle")}</h2>
                    </div>
                    <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {t("metadataAiHint")}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={toggleManualMetadata}
                    className="inline-flex min-h-10 w-full items-center justify-center gap-1 rounded-lg px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto sm:justify-start"
                    aria-expanded={showManualMetadata}
                  >
                    {t("manualMetadata")}
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform duration-300",
                        showManualMetadata && "rotate-180",
                      )}
                    />
                  </button>
                </div>

                <div
                  ref={metadataCollapseRef}
                  className={cn(
                    "grid [overflow-anchor:none] transition-[grid-template-rows] duration-300 ease-out",
                    showManualMetadata ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                  )}
                >
                  <div
                    className={cn(
                      "min-h-0 overflow-hidden",
                      !showManualMetadata && "pointer-events-none",
                    )}
                  >
                    <div className="grid gap-3 pt-3 md:grid-cols-2 sm:pt-4 sm:gap-4">
                      <div className="md:col-span-2">
                        <label htmlFor="book-title" className="mb-2 block text-sm font-medium">
                          {t("fieldTitle")}
                        </label>
                        <Input
                          id="book-title"
                          placeholder={suggestedTitleFromFile || t("fieldTitlePlaceholder")}
                          value={bookMetadata.title}
                          onChange={(e) => {
                            setManualMetadataOverride(true);
                            setBookMetadata({ ...bookMetadata, title: e.target.value });
                          }}
                          className="h-11 rounded-xl"
                        />
                      </div>
                      <div>
                        <label htmlFor="book-author" className="mb-2 block text-sm font-medium">
                          {t("fieldAuthor")}
                        </label>
                        <Input
                          id="book-author"
                          placeholder={t("fieldAuthorPlaceholder")}
                          value={bookMetadata.author}
                          onChange={(e) => {
                            setManualMetadataOverride(true);
                            setBookMetadata({ ...bookMetadata, author: e.target.value });
                          }}
                          className="h-11 rounded-xl"
                        />
                      </div>
                      <div>
                        <label htmlFor="book-cover-url" className="mb-2 block text-sm font-medium">
                          {t("fieldCover")}
                        </label>
                        <div className="flex min-w-0 gap-2">
                          <Input
                            id="book-cover-url"
                            placeholder={t("fieldCoverUrlPlaceholder")}
                            value={bookMetadata.cover}
                            onChange={(e) => {
                              const value = e.target.value;
                              setCoverFile(null);
                              if (coverInputRef.current) {
                                coverInputRef.current.value = "";
                              }
                              setBookMetadata({ ...bookMetadata, cover: value });
                              updateCoverPreview(value.trim() || null, false);
                            }}
                            className="h-11 min-w-0 flex-1 rounded-xl"
                          />
                          <input
                            ref={coverInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleCoverFileSelect(file);
                              }
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-11 w-11 shrink-0 rounded-xl"
                            onClick={() => coverInputRef.current?.click()}
                            aria-label={t("chooseCoverFile")}
                          >
                            <ImageIcon className="h-4 w-4" />
                          </Button>
                        </div>
                        {coverPreviewUrl ? (
                          <div className="mt-3 flex items-start gap-3 rounded-xl border border-border/50 bg-secondary/30 p-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={coverPreviewUrl}
                              alt={t("coverPreview")}
                              className="h-24 w-16 rounded-lg object-cover shadow-sm"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium">
                                {coverFile ? coverFile.name : t("coverFromUrl")}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {coverFile
                                  ? `${(coverFile.size / (1024 * 1024)).toFixed(2)} MB`
                                  : t("coverWillUpload")}
                              </p>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="mt-2 h-8 px-2 text-muted-foreground hover:text-destructive"
                                onClick={clearCover}
                              >
                                <X className="mr-1 h-3.5 w-3.5" />
                                {t("removeCover")}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-2 text-xs text-muted-foreground">{t("coverUrlHint")}</p>
                        )}
                      </div>
                      <div className="md:col-span-2">
                        <label
                          htmlFor="book-description"
                          className="mb-2 block text-sm font-medium"
                        >
                          {t("fieldDescription")}
                        </label>
                        <Textarea
                          id="book-description"
                          placeholder={t("fieldDescriptionPlaceholder")}
                          value={bookMetadata.description}
                          onChange={(e) => {
                            setManualMetadataOverride(true);
                            setBookMetadata({ ...bookMetadata, description: e.target.value });
                          }}
                          className="min-h-[100px] resize-none rounded-xl"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Error state */}
              {uploadStatus === "error" && uploadErrorMessage && (
                <div className="flex items-start gap-3 rounded-2xl bg-destructive/10 p-4 text-destructive animate-in fade-in duration-200">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-medium">{t("uploadErrorTitle")}</p>
                    <p className="mt-1 text-sm opacity-90">{uploadErrorMessage}</p>
                  </div>
                </div>
              )}

              {isAuthLoaded && !isSignedIn ? (
                <AuthSignInPrompt message={t("signInPrompt")} />
              ) : null}

              {/* Submit button */}
              <Button
                onClick={handleSubmit}
                disabled={
                  isUploading || !selectedFile || !detectedFormat || !isAuthLoaded || !isSignedIn
                }
                className="h-12 w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("processing")}
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    {t("submit")}
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
