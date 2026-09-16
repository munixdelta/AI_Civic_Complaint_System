import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FileImage,
  LocateFixed,
  LoaderCircle,
  RotateCcw,
  ScanSearch,
  Upload,
} from 'lucide-react';
import './App.css';
import {
  API_UPLOAD_LIMIT_BYTES,
  DetectionApiError,
  predictImage,
} from './services/detectionApi';
import {
  getCurrentLocation,
  locationErrorMessage,
  normalizePosition,
  reverseGeocode,
} from './services/locationApi';
import { resolveAuthority } from './services/authorityApi';
import { generateComplaintDraft, ComplaintApiError } from './services/complaintApi';
import { createCvkiCase, getCvkiCaseStatus, ComplaintCaseApiError } from './services/complaintCaseApi';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

function formatClassName(className) {
  return className
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function validateFile(file) {
  if (!file) return 'Choose an image before analyzing.';
  const hasSupportedType = ACCEPTED_TYPES.includes(file.type)
    || ACCEPTED_EXTENSIONS.some((extension) => file.name.toLowerCase().endsWith(extension));
  if (!hasSupportedType) return 'Choose a JPG, PNG, or WEBP image.';
  if (file.size === 0) return 'That image is empty. Choose another file.';
  if (file.size > API_UPLOAD_LIMIT_BYTES) return 'That image is larger than the 10 MB upload limit.';
  return null;
}

function DetectionWorkspace() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [location, setLocation] = useState(null);
  const [locationState, setLocationState] = useState('idle');
  const [locationError, setLocationError] = useState('');
  const [authority, setAuthority] = useState(null);
  const [authorityError, setAuthorityError] = useState('');
  const [complaint, setComplaint] = useState(null);
  const [complaintText, setComplaintText] = useState('');
  const [complaintTitle, setComplaintTitle] = useState('');
  const [complaintLanguage, setComplaintLanguage] = useState('en');
  const [isGeneratingComplaint, setIsGeneratingComplaint] = useState(false);
  const [complaintError, setComplaintError] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const [cvkiCase, setCvkiCase] = useState(null);
  const [caseStatus, setCaseStatus] = useState(null);
  const [caseError, setCaseError] = useState('');
  const [isCreatingCase, setIsCreatingCase] = useState(false);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function handleFileChange(event) {
    const file = event.target.files?.[0] || null;
    const validationError = validateFile(file);
    setResult(null);
    setComplaint(null);
    setComplaintText('');
    setComplaintTitle('');
    setComplaintError('');
    setCvkiCase(null);
    setCaseStatus(null);
    setCaseError('');
    setError(validationError || '');
    if (validationError) {
      setSelectedFile(null);
      setPreviewUrl('');
      return;
    }

    setSelectedFile(file);
    setPreviewUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return URL.createObjectURL(file);
    });
  }

  function resetWorkspace() {
    setSelectedFile(null);
    setResult(null);
    setError('');
    setPreviewUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return '';
    });
  }

  async function handleAnalyze() {
    const validationError = validateFile(selectedFile);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsAnalyzing(true);
    setError('');
    try {
      const payload = await predictImage(selectedFile);
      setResult(payload);
      setComplaint(null);
      setComplaintText('');
      setComplaintTitle('');
      setCvkiCase(null);
      setCaseStatus(null);
    } catch (caughtError) {
      const message = caughtError instanceof DetectionApiError
        ? caughtError.message
        : 'The image could not be analyzed. Try again.';
      setError(message);
      setResult(null);
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleGenerateComplaint() {
    if (!result || result.total_detections === 0) return;
    const detection = result.detections.reduce((best, current) => (
      current.confidence > best.confidence ? current : best
    ));
    setIsGeneratingComplaint(true);
    setComplaintError('');
    setCopyStatus('');
    try {
      const locationPayload = location?.address ? {
        road: location.address.road,
        area: location.address.area,
        city: location.address.city,
        district: location.address.district,
        state: location.address.state,
        latitude: location.coordinates.latitude,
        longitude: location.coordinates.longitude,
      } : null;
      const payload = await generateComplaintDraft({
        detection: { class_name: detection.class_name, confidence: detection.confidence },
        location: locationPayload,
        authority: authority?.authority || null,
        language: complaintLanguage,
        imageAttached: Boolean(selectedFile),
      });
      setComplaint(payload);
      setComplaintTitle(payload.title);
      setComplaintText(payload.description);
      setCvkiCase(null);
      setCaseStatus(null);
    } catch (caughtError) {
      setComplaintError(caughtError instanceof ComplaintApiError ? caughtError.message : 'The complaint draft could not be generated.');
    } finally {
      setIsGeneratingComplaint(false);
    }
  }

  async function handleCopyComplaint() {
    try {
      await navigator.clipboard.writeText(complaintText);
      setCopyStatus('Copied');
    } catch {
      setCopyStatus('Copy unavailable');
    }
  }

  async function handleCreateCase() {
    if (!complaint || !result) return;
    const detection = result.detections.reduce((best, current) => (
      current.confidence > best.confidence ? current : best
    ));
    setIsCreatingCase(true);
    setCaseError('');
    try {
      const locationPayload = location?.address ? {
        road: location.address.road,
        area: location.address.area,
        city: location.address.city,
        district: location.address.district,
        state: location.address.state,
        latitude: location.coordinates.latitude,
        longitude: location.coordinates.longitude,
      } : null;
      const created = await createCvkiCase({
        issue: { class_name: detection.class_name, label: complaint.issue_label, severity: complaint.severity, confidence: detection.confidence },
        location: locationPayload,
        authority: authority?.authority || null,
        complaint: { language: complaint.language, title: complaintTitle, description: complaintText },
        evidence: complaint.evidence,
      });
      setCvkiCase(created);
      setCaseStatus(null);
    } catch (caughtError) {
      setCaseError(caughtError instanceof ComplaintCaseApiError ? caughtError.message : 'The CVKI case could not be created.');
    } finally {
      setIsCreatingCase(false);
    }
  }

  async function handleViewCaseStatus() {
    if (!cvkiCase) return;
    try {
      setCaseStatus(await getCvkiCaseStatus(cvkiCase.reference_id));
      setCaseError('');
    } catch (caughtError) {
      setCaseError(caughtError instanceof ComplaintCaseApiError ? caughtError.message : 'The CVKI case status could not be loaded.');
    }
  }

  async function handleUseLocation() {
    setLocationState('loading');
    setLocationError('');
    setAuthority(null);
    setAuthorityError('');
    try {
      const position = await getCurrentLocation();
      const coordinates = normalizePosition(position);
      setLocation({ coordinates, address: null });
      try {
        const address = await reverseGeocode(coordinates);
        setLocation({ coordinates, address });
        try {
          setAuthority(await resolveAuthority({ coordinates, address }));
        } catch (caughtError) {
          setAuthorityError(caughtError.message || 'Authority information is temporarily unavailable.');
        }
        setLocationState('ready');
      } catch (caughtError) {
        setLocationState('partial');
        setLocationError(caughtError.message || 'Coordinates available, but road information could not be resolved.');
      }
    } catch (caughtError) {
      setLocation(null);
      setLocationState('error');
      setLocationError(locationErrorMessage(caughtError));
    }
  }

  return (
    <section className="workspace" aria-labelledby="workspace-title">
      <div className="workspace-intro">
        <div>
          <p className="eyebrow"><ScanSearch size={16} /> Civic image inspection</p>
          <h2 id="workspace-title">See the issue clearly.</h2>
          <p className="intro-copy">
            Upload a street image and let the M1.13 vision model identify visible civic problems.
          </p>
        </div>
        <div className="model-chip"><span /> M1.13 YOLOv8n ready</div>
      </div>

      <div className="workspace-grid">
        <div className="control-column">
          <div className="panel upload-panel">
            <div className="panel-heading">
              <div className="icon-box"><Upload size={18} /></div>
              <div>
                <h3>Inspect an image</h3>
                <p>JPG, PNG, or WEBP · up to 10 MB</p>
              </div>
            </div>
            <label className="file-drop" htmlFor="image-upload">
              <FileImage size={30} strokeWidth={1.5} />
              <strong>{selectedFile ? 'Choose a different image' : 'Select an image'}</strong>
              <span>{selectedFile ? selectedFile.name : 'Your image stays in this session'}</span>
              <input
                id="image-upload"
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                disabled={isAnalyzing}
              />
            </label>
            {previewUrl && (
              <div className="preview-frame">
                <img src={previewUrl} alt="Selected civic inspection" />
              </div>
            )}
            <div className="action-row">
              <button className="primary-button" type="button" onClick={handleAnalyze} disabled={!selectedFile || isAnalyzing}>
                {isAnalyzing ? <LoaderCircle className="spin" size={18} /> : <ScanSearch size={18} />}
                {isAnalyzing ? 'Analyzing image' : 'Analyze image'}
                {!isAnalyzing && <ArrowRight size={16} />}
              </button>
              {(selectedFile || result || error) && (
                <button className="icon-button" type="button" onClick={resetWorkspace} disabled={isAnalyzing} title="Reset inspection">
                  <RotateCcw size={18} />
                  <span className="sr-only">Reset inspection</span>
                </button>
              )}
            </div>
            {error && (
              <div className="message error-message" role="alert">
                <AlertCircle size={18} /> <span>{error}</span>
              </div>
            )}
          </div>
          <div className="privacy-note"><CheckCircle2 size={16} /> No images are stored by this workspace.</div>
          <div className="panel location-panel">
            <div className="panel-heading">
              <div className="icon-box"><LocateFixed size={18} /></div>
              <div>
                <h3>Location</h3>
                <p>Only requested when you choose to use it</p>
              </div>
            </div>
            <button className="location-button" type="button" onClick={handleUseLocation} disabled={locationState === 'loading'}>
              {locationState === 'loading' ? <LoaderCircle className="spin" size={17} /> : <LocateFixed size={17} />}
              {locationState === 'loading' ? 'Finding your location' : location ? 'Refresh current location' : 'Use My Current Location'}
            </button>
            {location && (
              <div className="location-details">
                <p><span>Road</span><strong>{location.address?.road || 'Unavailable'}</strong></p>
                <p><span>Area</span><strong>{location.address?.area || 'Unavailable'}</strong></p>
                <p><span>City</span><strong>{location.address?.city || 'Unavailable'}</strong></p>
                <p><span>District</span><strong>{location.address?.district || 'Unavailable'}</strong></p>
                <p><span>State</span><strong>{location.address?.state || 'Unavailable'}</strong></p>
                <p><span>Country</span><strong>{location.address?.country || 'Unavailable'}</strong></p>
                <p><span>Jurisdiction context</span><strong>{location.address?.jurisdiction?.name || 'Unknown'}</strong></p>
                <p><span>Source</span><strong>{location.address?.source || 'Unavailable'}</strong></p>
                <p><span>Resolution</span><strong>{location.address?.resolution_status || 'Unresolved'}</strong></p>
                {!location.address?.road && <div className="location-inline-message">{location.address?.message || 'Coordinates available, but road information could not be resolved.'}</div>}
                <p><span>Coordinates</span><strong>{location.coordinates.latitude.toFixed(5)}, {location.coordinates.longitude.toFixed(5)}</strong></p>
                <p><span>Accuracy</span><strong>±{Math.round(location.coordinates.accuracy_meters)} m</strong></p>
              </div>
            )}
            {locationError && <div className="message error-message" role="alert"><AlertCircle size={17} /><span>{locationError}</span></div>}
            {(locationState === 'error' || locationState === 'partial') && (
              <button className="text-button" type="button" onClick={handleUseLocation}>Try again</button>
            )}
            {authority && (
              <div className="authority-panel">
                <div className="authority-title"><strong>Responsible Authority</strong><span className={`authority-status ${authority.authority.authority_status}`}>{authority.authority.authority_status.replaceAll('_', ' ')}</span></div>
                {authority.authority.authority_status === 'not_verified' && (
                  <p className="authority-warning">Responsible road authority could not be verified from available authoritative data.</p>
                )}
                {authority.authority.road_owner && <p><span>Road owner</span><strong>{authority.authority.road_owner.name}</strong></p>}
                {authority.authority.maintenance_authority && <p><span>Maintenance authority</span><strong>{authority.authority.maintenance_authority.name}</strong></p>}
                {authority.authority.builder_or_contractor && <p><span>Builder / contractor</span><strong>{authority.authority.builder_or_contractor.name}</strong></p>}
                {authority.authority.evidence.length > 0 && <div className="authority-evidence"><span>Evidence</span>{authority.authority.evidence.map((item) => <strong key={`${item.source_name}-${item.claim}`}>{item.source_name}: {item.claim}</strong>)}</div>}
                {authority.authority.limitations.length > 0 && <div className="authority-limitations"><span>Limitations</span>{authority.authority.limitations.map((item) => <strong key={item}>{item}</strong>)}</div>}
              </div>
            )}
            {authorityError && <div className="message error-message" role="alert"><AlertCircle size={17} /><span>{authorityError}</span></div>}
          </div>
        </div>

        <div className="panel result-panel">
          <div className="panel-heading result-heading">
            <div>
              <p className="eyebrow">Analysis output</p>
              <h3>{result ? `${result.total_detections} issue${result.total_detections === 1 ? '' : 's'} found` : 'Annotated result'}</h3>
            </div>
            {result && <span className="result-version">{result.model_version}</span>}
          </div>
          {result ? (
            <>
              <div className="annotated-frame">
                <img src={result.annotated_image} alt="Annotated detection result" />
              </div>
              {result.total_detections === 0 ? (
                <div className="message success-message"><CheckCircle2 size={18} /><span>No civic issue detected in this image.</span></div>
              ) : (
                <div className="detection-list">
                  {result.detections.map((detection, index) => (
                    <div className="detection-row" key={`${detection.class_id}-${index}`}>
                      <div className="detection-marker" />
                      <div className="detection-info">
                        <strong>{formatClassName(detection.class_name)}</strong>
                        <span>{detection.class_name}</span>
                      </div>
                      <div className="confidence-value">{Math.round(detection.confidence * 100)}%</div>
                      <div className="bbox-value">{detection.bbox.x1}, {detection.bbox.y1} → {detection.bbox.x2}, {detection.bbox.y2}</div>
                    </div>
                  ))}
                </div>
              )}
              {result.total_detections > 0 && (
                <div className="complaint-panel">
                  <div className="complaint-heading">
                    <div><p className="eyebrow">Citizen draft</p><h3>Prepare a complaint</h3></div>
                    <span className="draft-only-badge">Draft only</span>
                  </div>
                  <div className="complaint-controls">
                    <label htmlFor="complaint-language">Language</label>
                    <select id="complaint-language" value={complaintLanguage} onChange={(event) => setComplaintLanguage(event.target.value)} disabled={isGeneratingComplaint}>
                      <option value="en">English</option>
                      <option value="hi">Hindi</option>
                      <option value="hinglish">Hinglish</option>
                    </select>
                    <button className="secondary-button" type="button" onClick={handleGenerateComplaint} disabled={isGeneratingComplaint}>
                      {isGeneratingComplaint ? <LoaderCircle className="spin" size={16} /> : <FileImage size={16} />}
                      {complaint ? 'Regenerate' : 'Generate Complaint'}
                    </button>
                  </div>
                  {complaint && (
                    <>
                      <div className="complaint-meta"><span>{complaint.issue_label}</span><span>{complaint.severity} priority</span><span>{complaint.authority_status.replaceAll('_', ' ')}</span></div>
                      <input className="complaint-title-input" value={complaintTitle} onChange={(event) => setComplaintTitle(event.target.value)} aria-label="Editable complaint title" />
                      <textarea className="complaint-text" value={complaintText} onChange={(event) => setComplaintText(event.target.value)} aria-label="Editable complaint draft" />
                      <div className="complaint-actions"><button className="secondary-button" type="button" onClick={handleCopyComplaint}><CheckCircle2 size={16} /> {copyStatus || 'Copy Complaint'}</button><button className="secondary-button case-create-button" type="button" onClick={handleCreateCase} disabled={isCreatingCase}>{isCreatingCase ? <LoaderCircle className="spin" size={16} /> : <CheckCircle2 size={16} />} {isCreatingCase ? 'Creating CVKI Case' : 'Create CVKI Case'}</button></div>
                      <span className="draft-note">M2.9 creates an editable draft only. M2.10 creates an internal CVKI case; it does not submit to government systems.</span>
                      {cvkiCase && <div className="case-summary"><p><span>CVKI Reference ID</span><strong>{cvkiCase.reference_id}</strong></p><p><span>Status</span><strong>Submitted to CVKI</strong></p><p><span>External Government Submission</span><strong>Not Submitted</strong></p><p><span>Follow-up</span><strong>{cvkiCase.follow_up.guidance}</strong></p><button className="text-button" type="button" onClick={handleViewCaseStatus}>View Case Status</button>{caseStatus && <div className="case-status-result"><strong>{caseStatus.status.replaceAll('_', ' ')}</strong><span>{caseStatus.status_description}</span></div>}</div>}
                    </>
                  )}
                  {complaintError && <div className="message error-message" role="alert"><AlertCircle size={17} /><span>{complaintError}</span></div>}
                  {caseError && <div className="message error-message" role="alert"><AlertCircle size={17} /><span>{caseError}</span></div>}
                </div>
              )}
            </>
          ) : (
            <div className="result-empty">
              <div className="empty-icon"><ScanSearch size={28} /></div>
              <h4>Your annotated image will appear here</h4>
              <p>Select an image, then run analysis to see model-detected civic issues.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function App() {
  return (
    <Router>
      <div className="app-shell">
        <header className="site-header">
          <Link to="/" className="brand"><span className="brand-mark">C</span><span>CVKI <small>field vision</small></span></Link>
          <nav className="site-nav" aria-label="Primary navigation">
            <Link to="/" className="active">Inspect</Link>
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/report">Report</Link>
          </nav>
        </header>
        <main>
          <Routes>
            <Route path="/" element={<DetectionWorkspace />} />
            <Route path="/report" element={<DetectionWorkspace />} />
            <Route path="/dashboard" element={<div className="simple-page"><p className="eyebrow">CVKI workspace</p><h2>Dashboard</h2><p>Detection history will be introduced in a later module.</p></div>} />
          </Routes>
        </main>
        <footer className="site-footer"><span>CVKI / Civic Vision & Knowledge Intelligence</span><span>M2.5 · Real-time visual inspection</span></footer>
      </div>
    </Router>
  );
}

export default App;
