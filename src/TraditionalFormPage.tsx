import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, Upload, Sparkles, Loader2, Download, FileUp, Eye, EyeOff } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import type { ExtractedData } from "./lib/gemini";
import { processDocuments } from "./lib/gemini";
import type { ProgressEvent } from "./lib/observers/ProcessingObserver";
import { OfflineNotifications } from "./lib/offline/OfflineNotifications";
import { ToastContainer } from "./components/ToastContainer";
import { encryptToonContent, decryptToonContent, isEncrypted, getPasswordStrength } from "./lib/encryption";

interface TraditionalFormPageProps {
  onBack: () => void;
  onSave: (data: ExtractedData) => void;
  onProcessComplete: (data: ExtractedData) => void;
  onToonImport?: (importedData: Partial<ExtractedData>, existingData: Partial<ExtractedData>) => void;
  initialData?: Partial<ExtractedData>;
}

export default function TraditionalFormPage({ onBack, onSave, onProcessComplete, onToonImport, initialData }: TraditionalFormPageProps) {
  const [data, setData] = useState<Partial<ExtractedData>>({
    name_english: "",
    name_bengali: "",
    father_name_english: "",
    father_name_bengali: "",
    mother_name_english: "",
    mother_name_bengali: "",
    date_of_birth: "",
    birth_day: "",
    birth_month: "",
    birth_year: "",
    place_of_birth: "",
    birth_registration_number: "",
    sex: "",
    permanent_address: "",
    current_address: "",
    utility_account_number: "",
    education_board: "",
    ssc_roll_number: "",
    ssc_registration_number: "",
    ssc_passing_year: "",
    institution_name: "",
    parent_nid_number: "",
    parent_name: "",
    relation: "",
    passport_number: "",
    tin_number: "",
    driving_license_number: "",
  });

  // Update form data when initialData changes (after coming back from Results)
  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      // Merge initialData with existing data
      setData(prevData => {
        const merged = { ...prevData };
        Object.entries(initialData).forEach(([key, value]) => {
          // Only update if new value is not empty/null/undefined
          if (value && value !== "" && value !== "undefined" && value !== "null") {
            merged[key as keyof ExtractedData] = value;
          }
        });
        return merged;
      });
    }
  }, [initialData]);

  // Load saved data from localStorage on component mount
  useEffect(() => {
    try {
      const savedData = localStorage.getItem('filr_form_data');
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        setData(prevData => {
          const merged = { ...prevData };
          Object.entries(parsedData).forEach(([key, value]) => {
            if (value && value !== "" && value !== "undefined" && value !== "null") {
              merged[key as keyof ExtractedData] = value as string;
            }
          });
          return merged;
        });
      }
    } catch (error) {
      console.error('Failed to load saved data from localStorage:', error);
    }
  }, []);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const toonInputRef = useRef<HTMLInputElement | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressInfo, setProgressInfo] = useState<{
    current: number;
    total: number;
    fileName: string;
    status: string;
  } | null>(null);

  // Password-protected download states
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [downloadPassword, setDownloadPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isEncrypting, setIsEncrypting] = useState(false);

  // Password-protected import states
  const [showDecryptModal, setShowDecryptModal] = useState(false);
  const [decryptPassword, setDecryptPassword] = useState("");
  const [showDecryptPassword, setShowDecryptPassword] = useState(false);
  const [encryptedFileContent, setEncryptedFileContent] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);

  const handleFieldChange = (field: keyof ExtractedData, value: string) => {
    setData({ ...data, [field]: value });
  };

  const handleUploadClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleImportToonClick = () => {
    if (toonInputRef.current) toonInputRef.current.click();
  };

  const parseTOON = (toonContent: string): Partial<ExtractedData> => {
    const parsedData: Partial<ExtractedData> = {};
    const lines = toonContent.trim().split('\n');

    let i = 0;
    while (i < lines.length) {
      const line = lines[i].trim();

      // Skip empty lines
      if (!line) {
        i++;
        continue;
      }

      // Check if line is a TOON array declaration: category[N]{fields}:
      const arrayMatch = line.match(/^(\w+)\[(\d+)\]\{([^}]+)\}:\s*$/);
      if (arrayMatch) {
        const fields = arrayMatch[3].split(',');
        i++; // Move to data line

        if (i < lines.length) {
          const dataLine = lines[i].trim();
          // Unescape TOON values
          const values = dataLine.split(/(?<!\\),/).map(v =>
            v.replace(/\\,/g, ',').replace(/\\n/g, '\n').replace(/\\\\/g, '\\').trim()
          );

          // Map fields to values - ONLY add if value is not empty
          fields.forEach((field, index) => {
            if (index < values.length) {
              const value = values[index];
              // Only add field if it has a non-empty value
              if (value && value !== "" && value !== "undefined" && value !== "null") {
                parsedData[field.trim() as keyof ExtractedData] = value;
              }
            }
          });
        }
        i++;
      } else {
        // Simple key: value format
        const simpleMatch = line.match(/^(\w+):\s*(.+)$/);
        if (simpleMatch) {
          const key = simpleMatch[1];
          const value = simpleMatch[2].replace(/\\,/g, ',').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
          // Only add field if it has a non-empty value
          if (value && value !== "" && value !== "undefined" && value !== "null") {
            parsedData[key as keyof ExtractedData] = value;
          }
        }
        i++;
      }
    }

    return parsedData;
  };

  const handleToonFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();

      // Check if file is encrypted
      if (isEncrypted(content)) {
        // Store encrypted content and show password prompt
        setEncryptedFileContent(content);
        setShowDecryptModal(true);
        return;
      }

      // File is not encrypted, parse normally
      const parsedData = parseTOON(content);

      // Check if we got any data
      const hasData = Object.values(parsedData).some(value => value && value !== "");

      if (!hasData) {
        alert("No valid data found in the TOON file.");
        return;
      }

      // If onToonImport callback is provided, use the new confirmation flow
      if (onToonImport) {
        onToonImport(parsedData, data);
      } else {
        // Fallback: merge directly and show in results (old behavior)
        const mergedData: Partial<ExtractedData> = { ...data };
        Object.entries(parsedData).forEach(([key, value]) => {
          if (value && value !== "" && value !== "undefined" && value !== "null") {
            mergedData[key as keyof ExtractedData] = value;
          }
        });
        onProcessComplete(mergedData as ExtractedData);
      }
    } catch (err) {
      console.error("Error parsing TOON file:", err);
      alert("Failed to parse TOON file. Please check the file format.");
    } finally {
      if (toonInputRef.current) toonInputRef.current.value = "";
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const apiKey = localStorage.getItem("gemini_api_key");
    const model = localStorage.getItem("gemini_model") || "Gemini 2.0 Flash";

    if (!apiKey) {
      alert("Please set your Gemini API key in settings first!");
      return;
    }

    try {
      setIsProcessing(true);
      setProgressInfo({ current: 0, total: files.length, fileName: "", status: "Starting..." });

      // Convert FileList to array
      const fileArray = Array.from(files);

      console.log("🔵 Starting document processing...", {
        fileCount: fileArray.length,
        fileNames: fileArray.map(f => f.name),
        apiKey: apiKey ? "✓ Set" : "✗ Missing",
        model
      });

      // Process documents with progress callback (Observer Pattern)
      const result = await processDocuments(fileArray, apiKey, model, (event: ProgressEvent) => {
        console.log("📊 Progress event:", event);
        // Update progress information
        setProgressInfo({
          current: event.current,
          total: event.total,
          fileName: event.fileName,
          status: event.status === "uploading" ? "Uploading" :
            event.status === "processing" ? "Processing" :
              event.status === "completed" ? "Completed" : "Error",
        });
      });

      console.log("✅ Processing complete! Result:", result);

      // Check if we got any data
      const hasData = Object.values(result).some(value => value && value !== "");
      console.log("📋 Has data?", hasData, "Data keys:", Object.keys(result));

      // Navigate to Results page with extracted data
      setProgressInfo(null);
      setIsProcessing(false);

      if (!hasData) {
        alert("⚠️ No data was extracted from the documents.\n\n" +
          "This could be because:\n" +
          "1. You've exceeded your Gemini API quota (check console for errors)\n" +
          "2. The documents are not readable\n" +
          "3. The API key is invalid\n\n" +
          "Check the browser console (F12) for detailed error messages.");
        return;
      }

      onProcessComplete(result);
    } catch (err) {
      console.error("❌ Auto-fill error:", err);
      console.error("❌ Error stack:", err instanceof Error ? err.stack : "N/A");
      setProgressInfo(null);

      // Check if it's a quota error
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("RESOURCE_EXHAUSTED")) {
        alert("⚠️ API Quota Exceeded!\n\n" +
          "You've exceeded your Gemini API quota.\n\n" +
          "Solutions:\n" +
          "• Wait 60 seconds and try again\n" +
          "• Check usage: https://ai.dev/usage\n" +
          "• Use a different API key\n" +
          "• Try uploading fewer files at once");
      } else {
        alert(err instanceof Error ? err.message : "Failed to auto-fill from documents");
      }
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = () => {
    // Filter out empty fields and save
    const filteredData = Object.entries(data).reduce((acc, [key, value]) => {
      if (value && value.trim() !== "") {
        acc[key as keyof ExtractedData] = value;
      }
      return acc;
    }, {} as Partial<ExtractedData>);

    // Check if at least some data is provided
    if (Object.keys(filteredData).length === 0) {
      alert("Please fill in at least some fields before saving.");
      return;
    }

    // Save to localStorage
    try {
      localStorage.setItem('filr_form_data', JSON.stringify(filteredData));

      // Show success notification
      const notifications = OfflineNotifications.getInstance();
      notifications.showToast({
        type: 'success',
        title: 'Saved successfully',
        message: 'Your information has been saved locally.',
        duration: 3000,
      });
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
      alert('Failed to save data. Please try again.');
    }
  };

  const handleDownloadJSON = () => {
    // Filter out empty fields
    const filteredData = Object.entries(data).reduce((acc, [key, value]) => {
      if (value && value.trim() !== "") {
        acc[key as keyof ExtractedData] = value;
      }
      return acc;
    }, {} as Partial<ExtractedData>);

    // Check if there's data to download
    if (Object.keys(filteredData).length === 0) {
      alert("No data to download. Please fill in some fields first.");
      return;
    }

    // Show password modal for encryption
    setShowPasswordModal(true);
  };

  const handlePasswordDownload = () => {
    if (!downloadPassword || downloadPassword.trim() === "") {
      alert("Please enter a password to protect your data.");
      return;
    }

    setIsEncrypting(true);

    // Small delay to show encryption state
    setTimeout(() => {
      try {
        // Filter out empty fields
        const filteredData = Object.entries(data).reduce((acc, [key, value]) => {
          if (value && value.trim() !== "") {
            acc[key as keyof ExtractedData] = value;
          }
          return acc;
        }, {} as Partial<ExtractedData>);

        // Convert to TOON format
        let toonString = "";

        // Group fields by category for better organization
        const categories = {
          birth_certificate: [
            'name_english', 'name_bengali', 'father_name_english', 'father_name_bengali',
            'mother_name_english', 'mother_name_bengali', 'date_of_birth', 'birth_day',
            'birth_month', 'birth_year', 'place_of_birth', 'birth_registration_number',
            'sex', 'permanent_address'
          ],
          address: ['current_address', 'utility_account_number'],
          education: [
            'education_board', 'ssc_roll_number', 'ssc_registration_number',
            'ssc_passing_year', 'institution_name'
          ],
          nid: ['parent_nid_number', 'parent_name', 'relation'],
          other_ids: ['passport_number', 'tin_number', 'driving_license_number']
        };

        // Helper function to escape TOON values
        const escapeTOON = (value: string): string => {
          // Escape commas, newlines, and backslashes
          if (value.includes(',') || value.includes('\n') || value.includes('\\')) {
            return value.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/\n/g, '\\n');
          }
          return value;
        };

        // Process each category
        Object.entries(categories).forEach(([categoryName, fields]) => {
          const categoryData = fields
            .filter(field => filteredData[field as keyof ExtractedData])
            .map(field => ({
              key: field,
              value: String(filteredData[field as keyof ExtractedData])
            }));

          if (categoryData.length > 0) {
            // Use TOON tabular format for arrays of objects
            const fieldNames = categoryData.map(d => d.key).join(',');
            const values = categoryData.map(d => escapeTOON(d.value)).join(',');

            toonString += `${categoryName}[${categoryData.length}]{${fieldNames}}:\n`;
            toonString += `  ${values}\n`;
          }
        });

        // If no categorized data, create a simple object notation
        if (toonString === "") {
          Object.entries(filteredData).forEach(([key, value]) => {
            toonString += `${key}: ${escapeTOON(String(value))}\n`;
          });
        }

        // Encrypt the TOON content with password
        const encryptedContent = encryptToonContent(toonString, downloadPassword);

        // Create blob and download link
        const blob = new Blob([encryptedContent], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
        link.download = `form-data-${timestamp}.toon`;
        link.href = url;

        // Trigger download
        document.body.appendChild(link);
        link.click();

        // Cleanup
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        // Show success notification
        const notifications = OfflineNotifications.getInstance();
        notifications.showToast({
          type: 'success',
          title: 'Download successful',
          message: 'Your encrypted TOON file has been downloaded.',
          duration: 3000,
        });

        // Close modal and reset
        setShowPasswordModal(false);
        setDownloadPassword("");
        setShowPassword(false);
      } catch (error) {
        console.error('Failed to encrypt and download:', error);
        alert('Failed to encrypt and download file. Please try again.');
      } finally {
        setIsEncrypting(false);
      }
    }, 300);
  };

  const handleDecryptAndImport = () => {
    if (!decryptPassword || decryptPassword.trim() === "") {
      alert("Please enter the password to decrypt the file.");
      return;
    }

    if (!encryptedFileContent) {
      alert("No encrypted file to decrypt.");
      return;
    }

    setIsDecrypting(true);

    // Small delay to show decrypting state
    setTimeout(() => {
      try {
        // Decrypt the content
        const decryptedContent = decryptToonContent(encryptedFileContent, decryptPassword);

        // Parse the decrypted TOON content
        const parsedData = parseTOON(decryptedContent);

        // Check if we got any data
        const hasData = Object.values(parsedData).some(value => value && value !== "");

        if (!hasData) {
          alert("No valid data found in the decrypted TOON file.");
          setShowDecryptModal(false);
          setEncryptedFileContent(null);
          setDecryptPassword("");
          setShowDecryptPassword(false);
          return;
        }

        // Close decrypt modal
        setShowDecryptModal(false);
        setEncryptedFileContent(null);
        setDecryptPassword("");
        setShowDecryptPassword(false);

        // If onToonImport callback is provided, use the new confirmation flow
        if (onToonImport) {
          onToonImport(parsedData, data);
        } else {
          // Fallback: merge directly and show in results (old behavior)
          const mergedData: Partial<ExtractedData> = { ...data };
          Object.entries(parsedData).forEach(([key, value]) => {
            if (value && value !== "" && value !== "undefined" && value !== "null") {
              mergedData[key as keyof ExtractedData] = value;
            }
          });
          onProcessComplete(mergedData as ExtractedData);
        }

        // Show success notification
        const notifications = OfflineNotifications.getInstance();
        notifications.showToast({
          type: 'success',
          title: 'Import successful',
          message: 'Your encrypted TOON file has been imported.',
          duration: 3000,
        });
      } catch (error) {
        console.error('Failed to decrypt TOON file:', error);
        alert('Failed to decrypt file. Please check your password and try again.');
      } finally {
        setIsDecrypting(false);
      }
    }, 300);
  };

  const renderField = (label: string, field: keyof ExtractedData, placeholder?: string) => {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={field} className="text-xs text-muted-foreground">
          {label}
        </Label>
        <Input
          id={field}
          type="text"
          value={data[field] || ""}
          onChange={(e) => handleFieldChange(field, e.target.value)}
          placeholder={placeholder}
          className="h-9 text-sm"
        />
      </div>
    );
  };

  return (
    <>
      {/* Toast notifications */}
      <ToastContainer />

      <div className="h-screen w-full bg-background flex flex-col">
        {/* Loading Modal - Observer Pattern Progress Display */}
        {isProcessing && progressInfo && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
            <Card className="w-96">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">Processing Documents</h3>
                      <p className="text-sm text-muted-foreground">
                        {progressInfo.current} of {progressInfo.total} files
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(progressInfo.current / progressInfo.total) * 100}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{progressInfo.status}</span>
                      <span>{Math.round((progressInfo.current / progressInfo.total) * 100)}%</span>
                    </div>
                  </div>

                  {/* Current File */}
                  <div className="bg-muted rounded p-3">
                    <p className="text-sm font-medium mb-1">Current file:</p>
                    <p className="text-xs text-muted-foreground truncate">{progressInfo.fileName}</p>
                  </div>

                  <p className="text-xs text-center text-muted-foreground">
                    Please wait while we extract information from your documents...
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Password Modal for Download */}
        {showPasswordModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle className="text-lg">Protect Your TOON File</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Enter a password to encrypt your data. You'll need this password to import the file later.
                </p>

                {/* Password Input */}
                <div className="space-y-2">
                  <Label htmlFor="download-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="download-password"
                      type={showPassword ? "text" : "password"}
                      value={downloadPassword}
                      onChange={(e) => setDownloadPassword(e.target.value)}
                      placeholder="Enter a strong password"
                      className="pr-10"
                      disabled={isEncrypting}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isEncrypting}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {/* Password Strength Indicator */}
                {downloadPassword && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Password strength:</span>
                      <span className={
                        getPasswordStrength(downloadPassword) === "strong" ? "text-green-600" :
                          getPasswordStrength(downloadPassword) === "medium" ? "text-yellow-600" :
                            "text-red-600"
                      }>
                        {getPasswordStrength(downloadPassword).toUpperCase()}
                      </span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${getPasswordStrength(downloadPassword) === "strong" ? "bg-green-600 w-full" :
                            getPasswordStrength(downloadPassword) === "medium" ? "bg-yellow-600 w-2/3" :
                              "bg-red-600 w-1/3"
                          }`}
                      />
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setShowPasswordModal(false);
                      setDownloadPassword("");
                      setShowPassword(false);
                    }}
                    disabled={isEncrypting}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handlePasswordDownload}
                    disabled={isEncrypting || !downloadPassword}
                  >
                    {isEncrypting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Encrypting...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Decrypt Modal for Import */}
        {showDecryptModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle className="text-lg">Decrypt TOON File</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  This file is password-protected. Enter the password to decrypt and import the data.
                </p>

                {/* Password Input */}
                <div className="space-y-2">
                  <Label htmlFor="decrypt-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="decrypt-password"
                      type={showDecryptPassword ? "text" : "password"}
                      value={decryptPassword}
                      onChange={(e) => setDecryptPassword(e.target.value)}
                      placeholder="Enter the password"
                      className="pr-10"
                      disabled={isDecrypting}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && decryptPassword) {
                          handleDecryptAndImport();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowDecryptPassword(!showDecryptPassword)}
                      disabled={isDecrypting}
                    >
                      {showDecryptPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setShowDecryptModal(false);
                      setEncryptedFileContent(null);
                      setDecryptPassword("");
                      setShowDecryptPassword(false);
                    }}
                    disabled={isDecrypting}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleDecryptAndImport}
                    disabled={isDecrypting || !decryptPassword}
                  >
                    {isDecrypting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Decrypting...
                      </>
                    ) : (
                      <>
                        <FileUp className="w-4 h-4 mr-2" />
                        Import
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Header */}
        <div className="flex-shrink-0 p-4 border-b">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-lg font-semibold">Update Your Information</h1>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <input ref={fileInputRef} type="file" accept="application/pdf,image/*" onChange={handleFileChange} className="hidden" multiple />
              <input ref={toonInputRef} type="file" accept=".toon,text/plain" onChange={handleToonFileChange} className="hidden" />
              <Button onClick={handleUploadClick} size="lg" variant="outline" disabled={isProcessing} className="flex flex-col gap-2 h-auto py-4">
                <Upload className="w-5 h-5" />
                <span className="text-xs">{isProcessing ? "Processing..." : "Upload & Auto-Fill"}</span>
              </Button>
              <Button onClick={handleImportToonClick} size="lg" variant="outline" className="flex flex-col gap-2 h-auto py-4">
                <FileUp className="w-5 h-5" />
                <span className="text-xs">Import TOON</span>
              </Button>
              <Button onClick={handleDownloadJSON} size="lg" variant="outline" className="flex flex-col gap-2 h-auto py-4">
                <Download className="w-5 h-5" />
                <span className="text-xs">Download TOON</span>
              </Button>
              <Button onClick={handleSave} size="lg" className="flex flex-col gap-2 h-auto py-4">
                <Save className="w-5 h-5" />
                <span className="text-xs">Save</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Birth Certificate Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Birth Certificate Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderField("Name (English)", "name_english", "Full name in English")}
                {renderField("Name (Bengali)", "name_bengali", "Full name in Bengali")}
                {renderField("Father's Name (English)", "father_name_english")}
                {renderField("Father's Name (Bengali)", "father_name_bengali")}
                {renderField("Mother's Name (English)", "mother_name_english")}
                {renderField("Mother's Name (Bengali)", "mother_name_bengali")}
                {renderField("Date of Birth", "date_of_birth", "DD/MM/YYYY")}

                <div className="md:col-span-2">
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Date Breakdown (Optional)</Label>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label htmlFor="birth_day" className="text-xs">Day</Label>
                      <Input
                        id="birth_day"
                        type="text"
                        value={data.birth_day || ""}
                        onChange={(e) => handleFieldChange("birth_day", e.target.value)}
                        placeholder="DD"
                        maxLength={2}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div>
                      <Label htmlFor="birth_month" className="text-xs">Month</Label>
                      <Input
                        id="birth_month"
                        type="text"
                        value={data.birth_month || ""}
                        onChange={(e) => handleFieldChange("birth_month", e.target.value)}
                        placeholder="MM"
                        maxLength={2}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div>
                      <Label htmlFor="birth_year" className="text-xs">Year</Label>
                      <Input
                        id="birth_year"
                        type="text"
                        value={data.birth_year || ""}
                        onChange={(e) => handleFieldChange("birth_year", e.target.value)}
                        placeholder="YYYY"
                        maxLength={4}
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>
                </div>

                {renderField("Place of Birth", "place_of_birth")}
                {renderField("Birth Registration Number", "birth_registration_number")}
                {renderField("Sex", "sex", "Male/Female")}
                {renderField("Permanent Address", "permanent_address")}
              </CardContent>
            </Card>

            {/* Address & Utility Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Address & Utility Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderField("Current Address", "current_address")}
                {renderField("Utility Account Number", "utility_account_number")}
              </CardContent>
            </Card>

            {/* Education Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Education Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderField("Institution Name", "institution_name")}
                {renderField("Education Board", "education_board")}
                {renderField("SSC Roll Number", "ssc_roll_number")}
                {renderField("SSC Registration Number", "ssc_registration_number")}
                {renderField("Passing Year", "ssc_passing_year", "YYYY")}
              </CardContent>
            </Card>

            {/* Parent/Spouse NID Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Parent/Spouse NID Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderField("Name", "parent_name")}
                {renderField("NID Number", "parent_nid_number")}
                {renderField("Relation", "relation", "Father/Mother/Spouse")}
              </CardContent>
            </Card>

            {/* Other Identification */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Other Identification</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderField("Passport Number", "passport_number")}
                {renderField("TIN Number", "tin_number")}
                {renderField("Driving License Number", "driving_license_number")}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer Button */}
        <div className="flex-shrink-0 p-4 border-t bg-background">
          <div className="max-w-4xl mx-auto flex gap-3">
            <Button onClick={onBack} variant="outline" className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSave} className="flex-1">
              <Save className="w-4 h-4 mr-2" />
              Save Information
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
