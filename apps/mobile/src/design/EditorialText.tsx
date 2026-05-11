import type { ReactNode } from "react";
import type { TextStyle } from "react-native";
import { Text } from "react-native";
import { palette, type as tokens } from "@language-coach/design-tokens";

type Kind = keyof typeof tokens;

type Props = {
  children: ReactNode;
  kind?: Kind;
  italic?: boolean;
  color?: string;
  align?: "auto" | "left" | "right" | "center";
  style?: TextStyle;
};

export function EditorialText({
  children,
  kind = "bodyMd",
  italic = false,
  color = palette.ink,
  align,
  style,
}: Props) {
  const base = tokens[kind];
  const italicLayer = italic ? tokens.italic : null;

  return (
    <Text style={[base, italicLayer, { color, textAlign: align }, style]}>
      {children}
    </Text>
  );
}
