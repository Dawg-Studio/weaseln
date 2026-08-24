"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faAddressCard,
    faBlog,
    faBriefcase,
    faCircleUser,
    faHeart,
    faPeopleGroup,
    faStar,
    faThumbtack,
} from "@fortawesome/free-solid-svg-icons";
import {
    type CardRadius,
    type CardShadow,
    type FontFamily,
    type HeadingSize,
    type ProfileCustomization,
    type ProfileSection,
    type SpacingDensity,
    type TextAlign,
} from "@/modules/profile-customization/types";

const RADIUS_CLASS: Record<CardRadius, string> = {
    none: "rounded-none",
    small: "rounded-sm",
    medium: "rounded-md",
    large: "rounded-lg",
    full: "rounded-full",
};

// Mirror of the live profile's ramp (UserOrgProfile.tsx) so the preview and
// the real page render the same warm elevation, not a cold neutral drop.
const SHADOW_CLASS: Record<CardShadow, string> = {
    none: "elev-0",
    subtle: "elev-1",
    medium: "elev-2",
    large: "elev-3",
};

const FONT_CLASS: Record<FontFamily, string> = {
    system: "font-sans",
    serif: "font-serif",
    sans: "font-sans",
    mono: "font-mono",
};

const HEADING_SIZE_CLASS: Record<HeadingSize, string> = {
    small: "text-2xl",
    medium: "text-3xl",
    large: "text-4xl",
};

const ALIGN_CLASS: Record<TextAlign, string> = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
};

const SPACING_CLASS: Record<SpacingDensity, string> = {
    compact: "space-y-2",
    comfortable: "space-y-4",
    spacious: "space-y-6",
};

const SECTION_ICONS: Record<ProfileSection, typeof faCircleUser> = {
    hero: faCircleUser,
    stats: faBlog,
    about: faAddressCard,
    socials: faPeopleGroup,
    featuredPost: faStar,
    interests: faHeart,
    organizations: faBriefcase,
    posts: faThumbtack,
};

const SECTION_LABELS: Record<ProfileSection, string> = {
    hero: "Hero",
    stats: "Stats",
    about: "About",
    socials: "Social Links",
    featuredPost: "Featured Post",
    interests: "Interests",
    organizations: "Organizations",
    posts: "Posts",
};

export default function ProfileCustomizationPreview({
    customization,
    name,
    image,
}: {
    customization: ProfileCustomization;
    name: string;
    image: string;
}) {
    const visibleSections = customization.layout.sectionOrder.filter(
        (s) => !customization.layout.hiddenSections.includes(s),
    );

    const bgStyle = {
        backgroundColor: customization.backgroundColor ?? undefined,
        color: customization.textColor ?? undefined,
    };

    const showImage = !!customization.backgroundImage;
    const imageStyle = showImage
        ? {
              backgroundImage: `url(${JSON.stringify(customization.backgroundImage)})`,
              backgroundSize: customization.backgroundSize,
              backgroundPosition: customization.backgroundPosition,
              backgroundRepeat: "no-repeat",
          }
        : {};

    return (
        <aside
            aria-label="Customization preview"
            className="sticky top-20 rounded-box border border-hairline bg-surface p-6 elev-3"
            style={bgStyle}
        >
            <div className="flex items-center justify-between mb-4">
                <h3
                    className={`text-headline text-base-content ${FONT_CLASS[customization.fontFamily]}`}
                >
                    Preview
                </h3>
                <span className="text-eyebrow uppercase text-muted">live</span>
            </div>

            <div className="space-y-4">
                {showImage && (
                    <div
                        className={`h-24 ${RADIUS_CLASS[customization.cardRadius]} ${SHADOW_CLASS[customization.cardShadow]}`}
                        style={imageStyle}
                        aria-hidden="true"
                    />
                )}

                {visibleSections.includes("hero") && (
                    <div
                        className={`text-center ${SPACING_CLASS[customization.spacingDensity]}`}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element -- preview mirrors the editor state; next/image is not needed for thumbnail-sized mock */}
                        <img
                            src={image}
                            alt=""
                            className={`w-16 h-16 mx-auto ${RADIUS_CLASS[customization.cardRadius]} object-cover`}
                        />
                        <h4
                            className={`${HEADING_SIZE_CLASS[customization.headingSize]} font-bold ${FONT_CLASS[customization.fontFamily]} ${ALIGN_CLASS[customization.textAlign]} mt-2`}
                        >
                            {name}
                        </h4>
                    </div>
                )}

                {visibleSections.length > 0 && (
                    <div
                        className={`border-t pt-3 ${SPACING_CLASS[customization.spacingDensity]}`}
                    >
                        <p className="text-xs opacity-60 mb-2">Sections shown</p>
                        <ul className="space-y-1">
                            {visibleSections.map((section) => (
                                <li
                                    key={section}
                                    className={`flex items-center gap-2 text-sm ${FONT_CLASS[customization.fontFamily]}`}
                                >
                                    <FontAwesomeIcon
                                        icon={SECTION_ICONS[section]}
                                        className="w-4 h-4 opacity-70"
                                    />
                                    <span>{SECTION_LABELS[section]}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </aside>
    );
}
