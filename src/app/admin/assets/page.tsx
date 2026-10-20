'use client';

import React, { useState, useEffect, useRef } from 'react';

interface StoredFile {
  url: string;
  storage_key: string;
  name: string;
  size: number;
  mime_type: string;
}

interface Asset {
  id: string;
  title: string;
  category: string;
  file_type: 'image' | 'text' | 'pdf' | 'video_link';
  content_url: string;
  body_text: string | null;
  storage_key: string | null;
  files?: StoredFile[];
  description: string | null;
  is_active: boolean;
  created_at: string;
}

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB per file
const MAX_IMAGES_COUNT = 5;

export default function AdminAssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [toastMsg, setToastMsg] = useState('');

  // Active slide index for card image carousels
  const [cardImageIndices, setCardImageIndices] = useState<Record<string, number>>({});

  // Fullscreen Image Lightbox with Left/Right Navigation
  const [lightboxData, setLightboxData] = useState<{ asset: Asset; index: number } | null>(null);

  // Multi-Download Choice Modal
  const [downloadPromptAsset, setDownloadPromptAsset] = useState<Asset | null>(null);

  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [createFormData, setCreateFormData] = useState({
    title: '',
    category: 'Brochures',
    file_type: 'image' as 'image' | 'text' | 'pdf' | 'video_link',
    body_text: '',
    content_url: '',
    description: '',
  });

  // Multiple selected images for creation (up to 5)
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [selectedSinglePdf, setSelectedSinglePdf] = useState<File | null>(null);

  // Edit Modal State
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [editFormData, setEditFormData] = useState({
    title: '',
    category: 'Brochures',
    body_text: '',
    content_url: '',
    description: '',
  });
  const [editImages, setEditImages] = useState<File[]>([]);
  const [editPdf, setEditPdf] = useState<File | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete Confirmation State
  const [confirmDeleteAsset, setConfirmDeleteAsset] = useState<Asset | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const editImageInputRef = useRef<HTMLInputElement | null>(null);
  const editPdfInputRef = useRef<HTMLInputElement | null>(null);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const query = typeFilter !== 'all' ? `?type=${typeFilter}` : '';
      const res = await fetch(`/api/assets${query}`);
      if (!res.ok) throw new Error('Failed to load assets');
      const data = await res.json();
      setAssets(data.assets || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [typeFilter]);

  // Handle image files selection (up to 5)
  const handleImageFilesChange = (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const currentTotal = isEdit ? editImages.length : selectedImages.length;
    if (currentTotal + files.length > MAX_IMAGES_COUNT) {
      const msg = `Maximum ${MAX_IMAGES_COUNT} images allowed per asset. (${currentTotal} already selected)`;
      if (isEdit) setEditError(msg);
      else setFormError(msg);
      e.target.value = '';
      return;
    }

    for (const file of files) {
      if (file.size > MAX_SIZE_BYTES) {
        const msg = `"${file.name}" is ${(file.size / (1024 * 1024)).toFixed(2)}MB. Each image must be under 5MB.`;
        if (isEdit) setEditError(msg);
        else setFormError(msg);
        e.target.value = '';
        return;
      }
      if (!file.type.startsWith('image/')) {
        const msg = `"${file.name}" is not a valid image format.`;
        if (isEdit) setEditError(msg);
        else setFormError(msg);
        e.target.value = '';
        return;
      }
    }

    if (isEdit) {
      setEditError('');
      setEditImages((prev) => [...prev, ...files]);
    } else {
      setFormError('');
      setSelectedImages((prev) => [...prev, ...files]);
    }
    e.target.value = '';
  };

  const removeSelectedImage = (index: number, isEdit = false) => {
    if (isEdit) {
      setEditImages((prev) => prev.filter((_, i) => i !== index));
    } else {
      setSelectedImages((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_SIZE_BYTES) {
      const msg = `Selected PDF is ${(file.size / (1024 * 1024)).toFixed(2)}MB. Maximum size is 5MB.`;
      if (isEdit) setEditError(msg);
      else setFormError(msg);
      e.target.value = '';
      return;
    }

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      const msg = 'Please choose a valid PDF file.';
      if (isEdit) setEditError(msg);
      else setFormError(msg);
      e.target.value = '';
      return;
    }

    if (isEdit) {
      setEditError('');
      setEditPdf(file);
    } else {
      setFormError('');
      setSelectedSinglePdf(file);
    }
  };

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);

    try {
      let res;
      if (createFormData.file_type === 'image') {
        if (selectedImages.length === 0) {
          throw new Error('Please select at least 1 image to upload (up to 5 images, max 5MB each).');
        }

        const data = new FormData();
        data.append('title', createFormData.title);
        data.append('category', createFormData.category);
        data.append('file_type', createFormData.file_type);
        data.append('body_text', createFormData.body_text);
        data.append('description', createFormData.description);
        selectedImages.forEach((img) => data.append('files', img));

        res = await fetch('/api/assets', {
          method: 'POST',
          body: data,
        });
      } else if (createFormData.file_type === 'pdf') {
        if (!selectedSinglePdf) {
          throw new Error('Please select a PDF document to upload (Max 5MB).');
        }

        const data = new FormData();
        data.append('title', createFormData.title);
        data.append('category', createFormData.category);
        data.append('file_type', createFormData.file_type);
        data.append('body_text', createFormData.body_text);
        data.append('description', createFormData.description);
        data.append('file', selectedSinglePdf);

        res = await fetch('/api/assets', {
          method: 'POST',
          body: data,
        });
      } else if (createFormData.file_type === 'video_link') {
        if (!createFormData.content_url.trim()) {
          throw new Error('Video link URL is required.');
        }

        res = await fetch('/api/assets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createFormData),
        });
      } else {
        // text template
        if (!createFormData.body_text.trim()) {
          throw new Error('Pitch template message text is required.');
        }

        res = await fetch('/api/assets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...createFormData,
            content_url: createFormData.body_text,
          }),
        });
      }

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to create asset');

      setIsCreateModalOpen(false);
      setSelectedImages([]);
      setSelectedSinglePdf(null);
      setCreateFormData({
        title: '',
        category: 'Brochures',
        file_type: 'image',
        body_text: '',
        content_url: '',
        description: '',
      });
      setToastMsg(`Asset "${resData.asset.title}" published.`);
      setTimeout(() => setToastMsg(''), 3500);
      fetchAssets();
    } catch (err: any) {
      setFormError(err.message || 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (asset: Asset) => {
    setEditingAsset(asset);
    setEditFormData({
      title: asset.title,
      category: asset.category,
      body_text: asset.body_text || (asset.file_type === 'text' ? asset.content_url : ''),
      content_url: asset.content_url,
      description: asset.description || '',
    });
    setEditImages([]);
    setEditPdf(null);
    setEditError('');
  };

  const handleUpdateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAsset) return;
    setEditError('');
    setIsEditing(true);

    try {
      let res;
      if (editingAsset.file_type === 'image' && editImages.length > 0) {
        const data = new FormData();
        data.append('title', editFormData.title);
        data.append('category', editFormData.category);
        data.append('body_text', editFormData.body_text);
        data.append('description', editFormData.description);
        editImages.forEach((img) => data.append('files', img));

        res = await fetch(`/api/assets/${editingAsset.id}`, {
          method: 'PUT',
          body: data,
        });
      } else if (editingAsset.file_type === 'pdf' && editPdf) {
        const data = new FormData();
        data.append('title', editFormData.title);
        data.append('category', editFormData.category);
        data.append('body_text', editFormData.body_text);
        data.append('description', editFormData.description);
        data.append('file', editPdf);

        res = await fetch(`/api/assets/${editingAsset.id}`, {
          method: 'PUT',
          body: data,
        });
      } else {
        res = await fetch(`/api/assets/${editingAsset.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: editFormData.title,
            category: editFormData.category,
            body_text: editFormData.body_text,
            description: editFormData.description,
            content_url: editingAsset.file_type === 'text' ? editFormData.body_text : editFormData.content_url,
          }),
        });
      }

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to update asset');

      setEditingAsset(null);
      setEditImages([]);
      setEditPdf(null);
      setToastMsg(`Asset "${resData.asset.title}" updated.`);
      setTimeout(() => setToastMsg(''), 3500);
      fetchAssets();
    } catch (err: any) {
      setEditError(err.message || 'Update failed.');
    } finally {
      setIsEditing(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteAsset) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/assets/${confirmDeleteAsset.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete asset');

      setToastMsg(`Asset "${confirmDeleteAsset.title}" deleted.`);
      setTimeout(() => setToastMsg(''), 3500);
      setConfirmDeleteAsset(null);
      fetchAssets();
    } catch {
      alert('Error deleting asset');
    } finally {
      setIsDeleting(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setToastMsg(`Copied ${label} to clipboard!`);
    setTimeout(() => setToastMsg(''), 3000);
  };

  // Carousel slide helpers
  const handlePrevImage = (assetId: string, total: number) => {
    setCardImageIndices((prev) => {
      const curr = prev[assetId] || 0;
      return { ...prev, [assetId]: (curr - 1 + total) % total };
    });
  };

  const handleNextImage = (assetId: string, total: number) => {
    setCardImageIndices((prev) => {
      const curr = prev[assetId] || 0;
      return { ...prev, [assetId]: (curr + 1) % total };
    });
  };

  // Trigger sequential download for all images
  const handleDownloadAll = (asset: Asset) => {
    if (!asset.files || asset.files.length === 0) return;
    asset.files.forEach((file, idx) => {
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = `${file.url}&download=true`;
        link.download = file.name || `image_${idx + 1}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, idx * 300);
    });
    setToastMsg(`Downloading all ${asset.files.length} images...`);
    setTimeout(() => setToastMsg(''), 3500);
    setDownloadPromptAsset(null);
  };

  const typeIconMap: Record<string, string> = {
    pdf: '📄',
    image: '🖼️',
    text: '📝',
    video_link: '🎥',
  };

  return (
    <div style={{ padding: '32px 40px', minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Toast Alert */}
      {toastMsg && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            zIndex: 9999,
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontWeight: 600,
            fontSize: '0.9rem',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <span>✓</span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Lightbox with Prev / Next Arrow Navigation */}
      {lightboxData && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 8, 16, 0.94)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '24px',
          }}
        >
          <div style={{ position: 'relative', maxWidth: '92vw', maxHeight: '92vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* Prev arrow (if multi image) */}
            {lightboxData.asset.files && lightboxData.asset.files.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const total = lightboxData.asset.files!.length;
                  setLightboxData({
                    ...lightboxData,
                    index: (lightboxData.index - 1 + total) % total,
                  });
                }}
                style={{
                  position: 'fixed',
                  left: '24px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(6px)',
                  color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.2)',
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 2,
                }}
              >
                ‹
              </button>
            )}

            <img
              src={
                lightboxData.asset.files && lightboxData.asset.files.length > 0
                  ? lightboxData.asset.files[lightboxData.index].url
                  : lightboxData.asset.content_url
              }
              alt="Preview"
              style={{
                maxWidth: '85vw',
                maxHeight: '85vh',
                objectFit: 'contain',
                borderRadius: '8px',
                boxShadow: '0 20px 50px rgba(0,0,0,0.85)',
              }}
            />

            {/* Next arrow (if multi image) */}
            {lightboxData.asset.files && lightboxData.asset.files.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const total = lightboxData.asset.files!.length;
                  setLightboxData({
                    ...lightboxData,
                    index: (lightboxData.index + 1) % total,
                  });
                }}
                style={{
                  position: 'fixed',
                  right: '24px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(6px)',
                  color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.2)',
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 2,
                }}
              >
                ›
              </button>
            )}

            {/* Top close button */}
            <button
              onClick={() => setLightboxData(null)}
              style={{
                position: 'fixed',
                top: '24px',
                right: '24px',
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: '#ef4444',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '1.1rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 3,
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Multi-Download Choice Modal */}
      {downloadPromptAsset && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 8, 16, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px',
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '420px',
              padding: '28px',
              boxShadow: 'var(--shadow-lg)',
              animation: 'slideUp 0.2s ease',
            }}
          >
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '8px' }}>Download Asset Images</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '20px' }}>
              This asset contains <strong>{downloadPromptAsset.files?.length || 1} images</strong>. Which would you like to download?
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <a
                href={`${downloadPromptAsset.files?.[cardImageIndices[downloadPromptAsset.id] || 0]?.url || downloadPromptAsset.content_url}&download=true`}
                download
                onClick={() => setDownloadPromptAsset(null)}
                className="btn-primary"
                style={{ padding: '12px', textAlign: 'center', textDecoration: 'none', fontSize: '0.9rem' }}
              >
                📥 Download Current Image ({ (cardImageIndices[downloadPromptAsset.id] || 0) + 1 })
              </a>

              <button
                onClick={() => handleDownloadAll(downloadPromptAsset)}
                className="btn-secondary"
                style={{ padding: '12px', fontSize: '0.9rem', color: '#c7d2fe', borderColor: '#818cf8' }}
              >
                📦 Download All ({downloadPromptAsset.files?.length || 1} Images)
              </button>

              <button
                type="button"
                onClick={() => setDownloadPromptAsset(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '0.85rem',
                  padding: '8px',
                  cursor: 'pointer',
                  marginTop: '4px',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '6px' }}>
            Marketing Assets & Templates
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Outreach creatives, WhatsApp copy, PDF one-pagers, demo video links, and pitch scripts
          </p>
        </div>

        <button
          id="add-asset-btn"
          onClick={() => {
            setIsCreateModalOpen(true);
            setFormError('');
            setSelectedImages([]);
            setSelectedSinglePdf(null);
          }}
          className="btn-primary"
          style={{ padding: '12px 22px', fontSize: '0.95rem' }}
        >
          <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>+</span>
          Add Outreach Asset
        </button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {[
          { id: 'all', label: 'All Materials' },
          { id: 'image', label: '🖼️ Images & Banners' },
          { id: 'pdf', label: '📄 PDF One-Pagers' },
          { id: 'video_link', label: '🎥 Demo Videos' },
          { id: 'text', label: '📝 Pitch Templates' },
        ].map((tab) => {
          const isSelected = typeFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setTypeFilter(tab.id)}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.88rem',
                fontWeight: 600,
                background: isSelected ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                border: isSelected ? '1px solid #818cf8' : '1px solid transparent',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Assets Grid */}
      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading marketing assets...
        </div>
      ) : assets.length === 0 ? (
        <div className="glass-panel" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📁</div>
          <p style={{ fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '6px' }}>
            No marketing materials in this category
          </p>
          <p style={{ fontSize: '0.85rem' }}>Click "+ Add Outreach Asset" to publish materials for team members.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: '22px' }}>
          {assets.map((asset) => {
            const hasMultiFiles = Array.isArray(asset.files) && asset.files.length > 0;
            const activeIndex = cardImageIndices[asset.id] || 0;
            const activeFile = hasMultiFiles ? asset.files![activeIndex] : null;
            const activeImageUrl = activeFile ? activeFile.url : asset.content_url;
            const bodyCopy = asset.body_text || (asset.file_type === 'text' ? asset.content_url : null);

            return (
              <div
                key={asset.id}
                className="glass-panel"
                style={{
                  padding: '22px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '16px',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div>
                  {/* Category & Type Pills Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: 'rgba(255, 255, 255, 0.06)',
                        color: '#c7d2fe',
                        border: '1px solid var(--border-subtle)',
                        textTransform: 'uppercase',
                      }}
                    >
                      <span>{typeIconMap[asset.file_type] || '📁'}</span>
                      <span>{asset.file_type.replace('_', ' ')}</span>
                    </span>

                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        background: 'rgba(255, 255, 255, 0.03)',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontWeight: 500,
                      }}
                    >
                      {asset.category}
                    </span>
                  </div>

                  {/* 1. DIRECT INLINE IMAGE PREVIEW WITH LEFT/RIGHT SCROLLERS (IF IMAGE TYPE) */}
                  {asset.file_type === 'image' && (
                    <div style={{ marginBottom: '14px', position: 'relative' }}>
                      <div
                        style={{
                          width: '100%',
                          height: '190px',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          background: '#090d16',
                          border: '1px solid var(--border-subtle)',
                          position: 'relative',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <img
                          src={activeImageUrl}
                          alt={asset.title}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            cursor: 'zoom-in',
                          }}
                          onClick={() => setLightboxData({ asset, index: activeIndex })}
                        />

                        {/* Floating Left Arrow on Card Image */}
                        {hasMultiFiles && asset.files!.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePrevImage(asset.id, asset.files!.length);
                            }}
                            style={{
                              position: 'absolute',
                              left: '8px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: 'rgba(15, 23, 42, 0.75)',
                              backdropFilter: 'blur(4px)',
                              border: '1px solid rgba(255,255,255,0.2)',
                              color: '#ffffff',
                              fontSize: '1.2rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
                            }}
                          >
                            ‹
                          </button>
                        )}

                        {/* Floating Right Arrow on Card Image */}
                        {hasMultiFiles && asset.files!.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNextImage(asset.id, asset.files!.length);
                            }}
                            style={{
                              position: 'absolute',
                              right: '8px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: 'rgba(15, 23, 42, 0.75)',
                              backdropFilter: 'blur(4px)',
                              border: '1px solid rgba(255,255,255,0.2)',
                              color: '#ffffff',
                              fontSize: '1.2rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
                            }}
                          >
                            ›
                          </button>
                        )}

                        {/* Zoom button */}
                        <div
                          onClick={() => setLightboxData({ asset, index: activeIndex })}
                          style={{
                            position: 'absolute',
                            bottom: '8px',
                            right: '8px',
                            background: 'rgba(0,0,0,0.65)',
                            backdropFilter: 'blur(4px)',
                            padding: '3px 7px',
                            borderRadius: '4px',
                            fontSize: '0.72rem',
                            color: '#ffffff',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          🔍 Zoom
                        </div>
                      </div>

                      {/* Dots & Indicator */}
                      {hasMultiFiles && asset.files!.length > 1 && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            marginTop: '8px',
                          }}
                        >
                          {asset.files!.map((_, idx) => (
                            <button
                              key={idx}
                              onClick={() => setCardImageIndices({ ...cardImageIndices, [asset.id]: idx })}
                              style={{
                                width: idx === activeIndex ? '18px' : '7px',
                                height: '7px',
                                borderRadius: '4px',
                                background: idx === activeIndex ? '#818cf8' : 'rgba(255,255,255,0.2)',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                              }}
                            />
                          ))}
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                            {activeIndex + 1}/{asset.files!.length}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Title */}
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
                    {asset.title}
                  </h3>

                  {/* Usage Instructions (Internal note for reps) */}
                  {asset.description && (
                    <p
                      style={{
                        fontSize: '0.82rem',
                        color: 'var(--text-muted)',
                        lineHeight: '1.45',
                        marginBottom: '10px',
                        whiteSpace: 'pre-line',
                        fontStyle: 'italic',
                      }}
                    >
                      💡 {asset.description}
                    </p>
                  )}

                  {/* 2. STYLED MONOSPACE BODY TEXT BOX WITH COPY BUTTON (ACROSS ALL TYPES) */}
                  {bodyCopy && (
                    <div
                      style={{
                        position: 'relative',
                        padding: '12px 14px',
                        background: 'rgba(15, 23, 42, 0.85)',
                        border: '1px dashed rgba(99, 102, 241, 0.3)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.8rem',
                        color: '#cbd5e1',
                        maxHeight: '130px',
                        overflowY: 'auto',
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'monospace',
                        lineHeight: '1.5',
                        marginBottom: '6px',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => copyToClipboard(bodyCopy, 'outreach copy')}
                        title="Copy message copy"
                        style={{
                          position: 'sticky',
                          top: '0',
                          float: 'right',
                          marginLeft: '8px',
                          background: 'rgba(99, 102, 241, 0.25)',
                          color: '#c7d2fe',
                          border: '1px solid rgba(99, 102, 241, 0.4)',
                          borderRadius: '4px',
                          padding: '2px 8px',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          zIndex: 1,
                        }}
                      >
                        📋 Copy Text
                      </button>
                      {bodyCopy}
                    </div>
                  )}
                </div>

                {/* Card Action Buttons Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {asset.file_type === 'image' ? (
                      <>
                        {hasMultiFiles && asset.files!.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => setDownloadPromptAsset(asset)}
                            className="btn-primary"
                            style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <span>📥</span>
                            <span>Download ({asset.files!.length})</span>
                          </button>
                        ) : (
                          <a
                            href={`${activeImageUrl}&download=true`}
                            download
                            className="btn-primary"
                            style={{ padding: '6px 12px', fontSize: '0.8rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <span>📥</span>
                            <span>Download</span>
                          </a>
                        )}

                        <button
                          onClick={() => setLightboxData({ asset, index: activeIndex })}
                          className="btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        >
                          👁️ View
                        </button>
                      </>
                    ) : asset.file_type === 'pdf' ? (
                      <>
                        <a
                          href={`${asset.content_url}?download=true`}
                          className="btn-primary"
                          style={{ padding: '6px 12px', fontSize: '0.8rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          download
                        >
                          <span>📥</span>
                          <span>Download PDF</span>
                        </a>
                        <a
                          href={asset.content_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.8rem', textDecoration: 'none' }}
                        >
                          👁️ Open ↗
                        </a>
                      </>
                    ) : asset.file_type === 'video_link' ? (
                      <>
                        <button
                          onClick={() => copyToClipboard(asset.content_url, 'video link')}
                          className="btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        >
                          🔗 Copy Video Link
                        </button>
                        <a
                          href={asset.content_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-primary"
                          style={{ padding: '6px 12px', fontSize: '0.8rem', textDecoration: 'none' }}
                        >
                          ▶️ Watch ↗
                        </a>
                      </>
                    ) : (
                      <button
                        onClick={() => copyToClipboard(bodyCopy || '', 'pitch template')}
                        className="btn-primary"
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                      >
                        📋 Copy Template
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => openEditModal(asset)}
                      title="Edit asset"
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        padding: '6px 9px',
                        fontSize: '0.85rem',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#818cf8')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => setConfirmDeleteAsset(asset)}
                      title="Delete asset"
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        padding: '6px 9px',
                        fontSize: '0.85rem',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE ASSET MODAL */}
      {isCreateModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 8, 16, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '560px',
              maxHeight: '88vh',
              overflowY: 'auto',
              padding: '30px',
              boxShadow: 'var(--shadow-lg)',
              animation: 'slideUp 0.25s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800 }}>Add Outreach Asset</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  Unified outreach assets with copy, instructions, and media uploads
                </p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                style={{ color: 'var(--text-muted)', fontSize: '1.4rem', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            {formError && (
              <div
                style={{
                  background: 'var(--danger-bg)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#fca5a5',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.85rem',
                  marginBottom: '16px',
                }}
              >
                ⚠️ {formError}
              </div>
            )}

            <form onSubmit={handleCreateAsset} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Asset Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Principal Connect: WhatsApp & Email Outreach Kit"
                  value={createFormData.title}
                  onChange={(e) => setCreateFormData({ ...createFormData, title: e.target.value })}
                  className="input-field"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    Content Type *
                  </label>
                  <select
                    value={createFormData.file_type}
                    onChange={(e) => {
                      const newType = e.target.value as any;
                      setCreateFormData({ ...createFormData, file_type: newType });
                      setSelectedImages([]);
                      setSelectedSinglePdf(null);
                      setFormError('');
                    }}
                    className="input-field"
                    style={{ background: '#0f172a' }}
                  >
                    <option value="image">🖼️ Images / Banners (Up to 5)</option>
                    <option value="pdf">📄 PDF Document (Upload)</option>
                    <option value="video_link">🎥 Video Link (URL Only)</option>
                    <option value="text">📝 Pitch Template (Text Only)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    Category
                  </label>
                  <select
                    value={createFormData.category}
                    onChange={(e) => setCreateFormData({ ...createFormData, category: e.target.value })}
                    className="input-field"
                    style={{ background: '#0f172a' }}
                  >
                    <option value="Brochures">Brochures</option>
                    <option value="Social Media">Social Media</option>
                    <option value="Pitch Templates">Pitch Templates</option>
                    <option value="Demos">Demos</option>
                    <option value="General">General</option>
                  </select>
                </div>
              </div>

              {/* EXTENDED MEDIA INPUT BASED ON TYPE */}
              {createFormData.file_type === 'image' ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Upload Images ({selectedImages.length} of {MAX_IMAGES_COUNT} selected) *
                    </label>
                    <span style={{ fontSize: '0.74rem', color: '#818cf8', fontWeight: 600 }}>
                      ⚡ Max 5MB per image (Stored in subfolder)
                    </span>
                  </div>

                  {selectedImages.length < MAX_IMAGES_COUNT && (
                    <div
                      onClick={() => imageInputRef.current?.click()}
                      style={{
                        border: '2px dashed rgba(99, 102, 241, 0.4)',
                        borderRadius: 'var(--radius-md)',
                        padding: '18px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: 'rgba(99, 102, 241, 0.04)',
                        marginBottom: '8px',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#818cf8')}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)')}
                    >
                      <input
                        ref={imageInputRef}
                        type="file"
                        multiple
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={(e) => handleImageFilesChange(e, false)}
                        style={{ display: 'none' }}
                      />
                      <div style={{ fontSize: '1.6rem', marginBottom: '4px' }}>📤</div>
                      <p style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '2px' }}>
                        Click to select images (Hold Ctrl/Shift for multiple)
                      </p>
                      <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        Up to 5 images (stored in clean asset folder in Neon)
                      </p>
                    </div>
                  )}

                  {selectedImages.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(85px, 1fr))', gap: '8px', marginTop: '6px' }}>
                      {selectedImages.map((file, idx) => (
                        <div
                          key={idx}
                          style={{
                            position: 'relative',
                            width: '100%',
                            height: '75px',
                            borderRadius: '6px',
                            overflow: 'hidden',
                            border: '1px solid var(--border-subtle)',
                            background: '#090d16',
                          }}
                        >
                          <img
                            src={URL.createObjectURL(file)}
                            alt={`Preview ${idx + 1}`}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          <button
                            type="button"
                            onClick={() => removeSelectedImage(idx, false)}
                            style={{
                              position: 'absolute',
                              top: '3px',
                              right: '3px',
                              width: '18px',
                              height: '18px',
                              borderRadius: '50%',
                              background: '#ef4444',
                              color: '#ffffff',
                              border: 'none',
                              fontSize: '0.62rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : createFormData.file_type === 'pdf' ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Upload PDF Document *
                    </label>
                    <span style={{ fontSize: '0.74rem', color: '#818cf8', fontWeight: 600 }}>
                      ⚡ Max: 5MB
                    </span>
                  </div>

                  <div
                    onClick={() => pdfInputRef.current?.click()}
                    style={{
                      border: '2px dashed rgba(99, 102, 241, 0.4)',
                      borderRadius: 'var(--radius-md)',
                      padding: '20px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: 'rgba(99, 102, 241, 0.04)',
                    }}
                  >
                    <input
                      ref={pdfInputRef}
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => handlePdfChange(e, false)}
                      style={{ display: 'none' }}
                    />
                    {selectedSinglePdf ? (
                      <div>
                        <div style={{ fontSize: '1.6rem', marginBottom: '4px' }}>📄</div>
                        <p style={{ fontWeight: 600, color: '#ffffff', fontSize: '0.85rem' }}>{selectedSinglePdf.name}</p>
                        <p style={{ fontSize: '0.74rem', color: '#a5b4fc' }}>
                          {(selectedSinglePdf.size / (1024 * 1024)).toFixed(2)} MB (Ready for upload)
                        </p>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: '1.6rem', marginBottom: '4px' }}>📤</div>
                        <p style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>Click to select a PDF file</p>
                        <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>PDF document up to 5MB</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : createFormData.file_type === 'video_link' ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Video URL (Links Only) *
                    </label>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      YouTube, Vimeo, Loom, or Drive
                    </span>
                  </div>
                  <input
                    type="url"
                    placeholder="https://www.youtube.com/watch?v=... or https://loom.com/..."
                    value={createFormData.content_url}
                    onChange={(e) => setCreateFormData({ ...createFormData, content_url: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
              ) : null}

              {/* 1. OUTREACH BODY TEXT / PITCH COPY (UNIVERSAL) */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Outreach Message / Pitch Copy {createFormData.file_type === 'text' ? '*' : '(Optional)'}
                  </label>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    WhatsApp caption, email pitch, or post script
                  </span>
                </div>
                <textarea
                  rows={4}
                  placeholder="Enter the message script or WhatsApp message that reps can copy and send alongside this asset..."
                  value={createFormData.body_text}
                  onChange={(e) => setCreateFormData({ ...createFormData, body_text: e.target.value })}
                  className="input-field"
                  style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '0.82rem' }}
                  required={createFormData.file_type === 'text'}
                />
              </div>

              {/* 2. USAGE INSTRUCTIONS / INTERNAL DESCRIPTION (UNIVERSAL) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Internal Usage Notes / Instructions (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Internal notes for reps (e.g. Best sent to School Principals during initial connect, WhatsApp between 10am-12pm)..."
                  value={createFormData.description}
                  onChange={(e) => setCreateFormData({ ...createFormData, description: e.target.value })}
                  className="input-field"
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '6px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="btn-secondary"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  id="submit-asset-btn"
                  type="submit"
                  className="btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Publishing Asset...' : 'Publish Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ASSET MODAL */}
      {editingAsset && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 8, 16, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '560px',
              maxHeight: '88vh',
              overflowY: 'auto',
              padding: '30px',
              boxShadow: 'var(--shadow-lg)',
              animation: 'slideUp 0.25s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800 }}>Edit Marketing Asset</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  Update title, pitch copy, instructions, or replace media
                </p>
              </div>
              <button
                onClick={() => setEditingAsset(null)}
                style={{ color: 'var(--text-muted)', fontSize: '1.4rem', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            {editError && (
              <div
                style={{
                  background: 'var(--danger-bg)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#fca5a5',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.85rem',
                  marginBottom: '16px',
                }}
              >
                ⚠️ {editError}
              </div>
            )}

            <form onSubmit={handleUpdateAsset} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Asset Title *
                </label>
                <input
                  type="text"
                  value={editFormData.title}
                  onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                  className="input-field"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    Type (Fixed)
                  </label>
                  <input
                    type="text"
                    value={editingAsset.file_type.toUpperCase()}
                    disabled
                    className="input-field"
                    style={{ opacity: 0.6, background: '#0f172a' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    Category
                  </label>
                  <select
                    value={editFormData.category}
                    onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                    className="input-field"
                    style={{ background: '#0f172a' }}
                  >
                    <option value="Brochures">Brochures</option>
                    <option value="Social Media">Social Media</option>
                    <option value="Pitch Templates">Pitch Templates</option>
                    <option value="Demos">Demos</option>
                    <option value="General">General</option>
                  </select>
                </div>
              </div>

              {/* MEDIA REPLACEMENT */}
              {editingAsset.file_type === 'image' ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Replace Images (Upload up to 5)
                    </label>
                    <span style={{ fontSize: '0.74rem', color: '#818cf8', fontWeight: 600 }}>
                      ⚡ Max: 5MB per image
                    </span>
                  </div>

                  <div
                    onClick={() => editImageInputRef.current?.click()}
                    style={{
                      border: '1px dashed var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '16px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: 'rgba(255, 255, 255, 0.02)',
                    }}
                  >
                    <input
                      ref={editImageInputRef}
                      type="file"
                      multiple
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={(e) => handleImageFilesChange(e, true)}
                      style={{ display: 'none' }}
                    />
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      Click to select replacement image(s) (Replaces old subfolder files)
                    </p>
                  </div>

                  {editImages.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(75px, 1fr))', gap: '8px', marginTop: '8px' }}>
                      {editImages.map((file, idx) => (
                        <div key={idx} style={{ position: 'relative', height: '65px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                          <img src={URL.createObjectURL(file)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <button
                            type="button"
                            onClick={() => removeSelectedImage(idx, true)}
                            style={{
                              position: 'absolute',
                              top: '2px',
                              right: '2px',
                              width: '18px',
                              height: '18px',
                              borderRadius: '50%',
                              background: '#ef4444',
                              color: '#ffffff',
                              border: 'none',
                              fontSize: '0.6rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : editingAsset.file_type === 'pdf' ? (
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    Replace PDF Document (Optional)
                  </label>
                  <div
                    onClick={() => editPdfInputRef.current?.click()}
                    style={{
                      border: '1px dashed var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '14px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: 'rgba(255, 255, 255, 0.02)',
                    }}
                  >
                    <input
                      ref={editPdfInputRef}
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => handlePdfChange(e, true)}
                      style={{ display: 'none' }}
                    />
                    {editPdf ? (
                      <p style={{ color: '#a5b4fc', fontSize: '0.85rem', fontWeight: 600 }}>
                        ✓ New PDF: {editPdf.name} ({(editPdf.size / (1024 * 1024)).toFixed(2)} MB)
                      </p>
                    ) : (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        Click to select a new PDF document (Max 5MB)
                      </p>
                    )}
                  </div>
                </div>
              ) : editingAsset.file_type === 'video_link' ? (
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    Video URL *
                  </label>
                  <input
                    type="url"
                    value={editFormData.content_url}
                    onChange={(e) => setEditFormData({ ...editFormData, content_url: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
              ) : null}

              {/* OUTREACH BODY TEXT */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Outreach Message / Pitch Copy {editingAsset.file_type === 'text' ? '*' : '(Optional)'}
                </label>
                <textarea
                  rows={4}
                  value={editFormData.body_text}
                  onChange={(e) => setEditFormData({ ...editFormData, body_text: e.target.value })}
                  className="input-field"
                  style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '0.82rem' }}
                  required={editingAsset.file_type === 'text'}
                />
              </div>

              {/* USAGE INSTRUCTIONS */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Internal Usage Notes / Instructions (Optional)
                </label>
                <textarea
                  rows={2}
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  className="input-field"
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '6px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  type="button"
                  onClick={() => setEditingAsset(null)}
                  className="btn-secondary"
                  disabled={isEditing}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isEditing}
                >
                  {isEditing ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL FOR ASSET DELETION */}
      {confirmDeleteAsset && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 8, 16, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '20px',
            animation: 'fadeIn 0.15s ease',
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '460px',
              padding: '28px',
              boxShadow: 'var(--shadow-lg)',
              animation: 'slideUp 0.2s ease',
              border: '1px solid rgba(239, 68, 68, 0.3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.4rem',
                }}
              >
                🗑️
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Delete Marketing Asset?</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {confirmDeleteAsset.title}
                </span>
              </div>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '24px' }}>
              Are you sure you want to delete this marketing asset?
              <span style={{ display: 'block', marginTop: '6px', color: '#fca5a5', fontWeight: 600 }}>
                ⚠️ The entire asset folder and all stored files in Neon Object Storage will be permanently purged.
              </span>
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setConfirmDeleteAsset(null)}
                className="btn-secondary"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                style={{
                  padding: '10px 20px',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  color: '#ffffff',
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)',
                }}
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete Asset & Folder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
