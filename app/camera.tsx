import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { X, Zap, ImageIcon, RotateCcw } from 'lucide-react-native';
import { router } from 'expo-router';
import { Colors, Spacing, FontSize, BorderRadius, Shadow } from '../constants/theme';
import { recognizeText } from '../services/ocrService';

// OCR result type
export interface OCRResult {
  name?: string;
  dosage?: string;
  expiryDate?: string;
  quantity?: string;
  rawText: string;
}

/**
 * Parse recognized text to extract medicine information.
 * Looks for patterns like:
 * - Medicine name (first prominent line)
 * - Dosage: "500mg", "250 mg", "5ml", etc.
 * - Expiry: "EXP 12/2026", "Expiry: 2026-12", "Best Before: Mar 2027"
 * - Quantity: "30 Tablets", "60 Capsules", "100ml"
 */
function parseOCRText(text: string): OCRResult {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const result: OCRResult = { rawText: text };

  // Extract dosage pattern: number + unit (mg, ml, mcg, g, iu)
  const dosageRegex = /(\d+\.?\d*)\s*(mg|ml|mcg|g|iu|units?)/i;
  for (const line of lines) {
    const match = line.match(dosageRegex);
    if (match) {
      result.dosage = `${match[1]}${match[2].toLowerCase()}`;
      break;
    }
  }

  // Extract expiry date
  const expiryPatterns = [
    /(?:exp(?:iry)?|best\s*before|bb|use\s*before)[:\s]*(\d{1,2})[\/\-](\d{4})/i,
    /(?:exp(?:iry)?|best\s*before|bb|use\s*before)[:\s]*(\d{4})[\/\-](\d{1,2})/i,
    /(?:exp(?:iry)?|best\s*before|bb)[:\s]*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s*(\d{4})/i,
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
  ];

  for (const line of lines) {
    for (const pattern of expiryPatterns) {
      const match = line.match(pattern);
      if (match) {
        // Try to construct a date string
        if (match.length === 4) {
          // DD/MM/YYYY format
          result.expiryDate = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
        } else if (match.length === 3) {
          const months: Record<string, string> = {
            jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
            jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
          };
          const monthStr = months[match[1].toLowerCase().slice(0, 3)];
          if (monthStr) {
            result.expiryDate = `${match[2]}-${monthStr}-01`;
          } else {
            // MM/YYYY or YYYY/MM
            const first = parseInt(match[1]);
            const second = parseInt(match[2]);
            if (first > 12) {
              // YYYY-MM
              result.expiryDate = `${match[1]}-${match[2].padStart(2, '0')}-01`;
            } else {
              // MM/YYYY
              result.expiryDate = `${match[2]}-${match[1].padStart(2, '0')}-01`;
            }
          }
        }
        break;
      }
    }
    if (result.expiryDate) break;
  }

  // Extract quantity pattern: number + unit (tablets, capsules, pills, etc.)
  const quantityRegex = /(\d+)\s*(tablets?|capsules?|pills?|strips?|sachets?|vials?|bottles?|ml|pieces?)/i;
  for (const line of lines) {
    const match = line.match(quantityRegex);
    if (match) {
      result.quantity = match[1];
      break;
    }
  }

  // Extract medicine name — usually the first prominent line (all caps or title case, longer than 3 chars)
  // Skip lines that are just numbers, dosage, or generic labels
  const skipPatterns = /^(mfg|mfd|batch|lot|exp|price|mrp|net|qty|pack|store|keep|warning|caution|\d+)/i;
  for (const line of lines) {
    const cleanLine = line.replace(/[®™©]/g, '').trim();
    if (
      cleanLine.length > 2 &&
      !skipPatterns.test(cleanLine) &&
      !dosageRegex.test(cleanLine) &&
      !quantityRegex.test(cleanLine)
    ) {
      result.name = cleanLine;
      break;
    }
  }

  return result;
}

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const hasPermission = permission?.granted ?? null;

  const handleCapture = async () => {
    if (!cameraRef.current) return;

    try {
      setIsProcessing(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });
      if (!photo) {
        Alert.alert('Error', 'Failed to capture image. Please try again.');
        return;
      }
      setCapturedImage(photo.uri);
      await processImage(photo.uri);
    } catch (error) {
      console.error('Error capturing image:', error);
      Alert.alert('Error', 'Failed to capture image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setIsProcessing(true);
        setCapturedImage(result.assets[0].uri);
        await processImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image.');
    } finally {
      setIsProcessing(false);
    }
  };

  const processImage = async (uri: string) => {
    try {
      let recognizedText = '';

      try {
        // Use Google Cloud Vision API — works everywhere (Expo Go, web, native builds)
        recognizedText = await recognizeText(uri);
      } catch (ocrError: any) {
        console.warn('Cloud Vision OCR failed:', ocrError.message || ocrError);
        // Show the specific error so the user knows what to fix
        const msg = ocrError.message?.includes('not enabled')
          ? ocrError.message
          : 'OCR could not process this image. Make sure Cloud Vision API is enabled for your Firebase project.';
        Alert.alert('OCR Unavailable', msg, [
          { text: 'Try Again', onPress: () => setCapturedImage(null) },
          { text: 'Enter Manually', onPress: () => router.back() },
        ]);
        return;
      }

      if (recognizedText) {
        const parsed = parseOCRText(recognizedText);
        
        // Navigate back to add screen with parsed data
        router.navigate({
          pathname: '/(tabs)/add',
          params: {
            ocrName: parsed.name || '',
            ocrDosage: parsed.dosage || '',
            ocrExpiry: parsed.expiryDate || '',
            ocrQuantity: parsed.quantity || '',
            ocrRawText: parsed.rawText,
          },
        });
      } else {
        Alert.alert(
          'No Text Found',
          'Could not recognize text in the image. Try taking a clearer photo with good lighting.',
          [
            { text: 'Try Again', onPress: () => setCapturedImage(null) },
            { text: 'Enter Manually', onPress: () => router.back() },
          ]
        );
      }
    } catch (error) {
      console.error('OCR processing error:', error);
      Alert.alert(
        'Processing Error',
        'Failed to process the image. You can enter medicine details manually.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    }
  };

  // Permission not yet loaded
  if (hasPermission === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // Permission not granted
  if (!hasPermission) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.permissionTitle}>Camera Permission Needed</Text>
          <Text style={styles.permissionText}>
            MediFill needs camera access to scan medicine labels and auto-fill details.
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.back()}
          >
            <Text style={styles.secondaryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Show captured image preview while processing
  if (capturedImage) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.previewContainer}>
          <Image source={{ uri: capturedImage }} style={styles.previewImage} />
          {isProcessing && (
            <View style={styles.processingOverlay}>
              <ActivityIndicator size="large" color={Colors.white} />
              <Text style={styles.processingText}>Scanning medicine label...</Text>
            </View>
          )}
          {!isProcessing && (
            <View style={styles.retakeBar}>
              <TouchableOpacity
                style={styles.retakeButton}
                onPress={() => setCapturedImage(null)}
              >
                <RotateCcw size={20} color={Colors.white} />
                <Text style={styles.retakeText}>Retake</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // Web fallback — no camera available
  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
            <X size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan Medicine</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.permissionTitle}>Camera Not Available</Text>
          <Text style={styles.permissionText}>
            Camera scanning is only available on mobile devices. You can upload a photo instead.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={handlePickImage}>
            <ImageIcon size={20} color={Colors.white} />
            <Text style={[styles.permissionButtonText, { marginLeft: 8 }]}>Upload Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()}>
            <Text style={styles.secondaryButtonText}>Enter Manually</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Native camera view
  return (
    <SafeAreaView style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back">
        {/* Top bar */}
        <View style={styles.cameraTopBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.cameraCloseButton}>
            <X size={24} color={Colors.white} />
          </TouchableOpacity>
        </View>

        {/* Scan guide overlay */}
        <View style={styles.scanGuide}>
          <View style={styles.scanFrame}>
            <View style={[styles.scanCorner, styles.topLeft]} />
            <View style={[styles.scanCorner, styles.topRight]} />
            <View style={[styles.scanCorner, styles.bottomLeft]} />
            <View style={[styles.scanCorner, styles.bottomRight]} />
          </View>
          <Text style={styles.scanHint}>
            Align the medicine label within the frame
          </Text>
        </View>

        {/* Bottom controls */}
        <View style={styles.cameraControls}>
          <TouchableOpacity style={styles.galleryButton} onPress={handlePickImage}>
            <ImageIcon size={24} color={Colors.white} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.captureButton}
            onPress={handleCapture}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <View style={styles.captureButtonInner} />
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.flashButton}>
            <Zap size={24} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </CameraView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.xl,
    backgroundColor: Colors.white,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  permissionText: {
    fontSize: FontSize.md,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginBottom: Spacing.xxl,
    lineHeight: 24,
  },
  permissionButton: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  permissionButtonText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.lg,
  },
  secondaryButtonText: {
    color: Colors.primary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  camera: {
    flex: 1,
  },
  cameraTopBar: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    padding: Spacing.xl,
    paddingTop: Spacing.xxxxl,
  },
  cameraCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanGuide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 280,
    height: 180,
    position: 'relative',
  },
  scanCorner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: Colors.white,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  scanHint: {
    color: Colors.white,
    fontSize: FontSize.sm,
    marginTop: Spacing.xl,
    textAlign: 'center',
    opacity: 0.8,
  },
  cameraControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: Spacing.xxxxl,
    paddingHorizontal: Spacing.xxxl,
  },
  galleryButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.white,
  },
  captureButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.white,
  },
  flashButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewContainer: {
    flex: 1,
  },
  previewImage: {
    flex: 1,
    resizeMode: 'contain',
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    color: Colors.white,
    fontSize: FontSize.md,
    marginTop: Spacing.lg,
    fontWeight: '600',
  },
  retakeBar: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  retakeText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: '600',
    marginLeft: Spacing.sm,
  },
});
