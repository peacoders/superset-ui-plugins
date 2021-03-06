/* eslint-disable no-magic-numbers */
import { CSSProperties } from 'react';
import { getTextDimension, Margin, Dimension } from '@superset-ui/dimension';
import { CategoricalColorScale } from '@superset-ui/color';
import { extractFormatFromTypeAndFormat } from './parsers/extractFormat';
import { CoreAxis, LabelOverlapStrategy, AxisOrient } from './types/Axis';
import { PositionFieldDef, ChannelDef } from './types/ChannelDef';
import ChannelEncoder from './ChannelEncoder';
import { DEFAULT_LABEL_ANGLE } from '../utils/constants';

const DEFAULT_BASE_CONFIG: {
  labelOverlap: LabelOverlapStrategy;
  labelPadding: number;
  tickCount: number;
} = {
  labelOverlap: 'auto',
  labelPadding: 4,
  tickCount: 5,
};

const DEFAULT_X_CONFIG: CoreAxis = {
  ...DEFAULT_BASE_CONFIG,
  labelAngle: DEFAULT_LABEL_ANGLE,
  orient: 'bottom',
};

const DEFAULT_Y_CONFIG: CoreAxis = {
  ...DEFAULT_BASE_CONFIG,
  labelAngle: 0,
  orient: 'left',
};

export interface AxisLayout {
  axisWidth: number;
  labelAngle: number;
  labelFlush: number | boolean;
  labelOffset: number;
  labelOverlap: 'flat' | 'rotate';
  minMargin: Partial<Margin>;
  orient: AxisOrient;
  tickLabelDimensions: Dimension[];
  tickLabels: string[];
  tickTextAnchor?: string;
}

export default class AxisAgent<Def extends ChannelDef> {
  private readonly channelEncoder: ChannelEncoder<Def>;
  private readonly format?: (value: any) => string;
  readonly config: CoreAxis;

  constructor(channelEncoder: ChannelEncoder<Def>) {
    this.channelEncoder = channelEncoder;
    const definition = channelEncoder.definition as PositionFieldDef;
    const { type, axis = {} } = definition;

    this.config = this.channelEncoder.isX()
      ? { ...DEFAULT_X_CONFIG, ...axis }
      : { ...DEFAULT_Y_CONFIG, ...axis };

    if (typeof axis.format !== 'undefined') {
      this.format = extractFormatFromTypeAndFormat(type, axis.format);
    }
  }

  getFormat() {
    return this.format || this.channelEncoder.formatValue;
  }

  hasTitle() {
    return this.getTitle() !== '';
  }

  getTitle() {
    const { title } = this.config;

    if (title === undefined || title === true) {
      return this.channelEncoder.getTitle();
    } else if (title === false || title === '') {
      return '';
    }

    return title;
  }

  getTickLabels() {
    const { tickCount, values } = this.config;

    const format = this.getFormat();
    if (typeof values !== 'undefined') {
      return (values as any[]).map(format);
    }

    if (typeof this.channelEncoder.scale !== 'undefined') {
      const { scale } = this.channelEncoder.scale;
      if (typeof scale !== 'undefined' && !(scale instanceof CategoricalColorScale)) {
        return ('ticks' in scale && typeof scale.ticks !== 'undefined'
          ? scale.ticks(tickCount)
          : scale.domain()
        ).map(format);
      }
    }

    return [];
  }

  // eslint-disable-next-line complexity
  computeLayout({
    axisTitleHeight = 20,
    axisWidth,
    gapBetweenAxisLabelAndBorder = 4,
    gapBetweenTickAndTickLabel = 4,
    labelAngle = this.config.labelAngle,
    tickSize = 8,
    tickTextStyle = {},
  }: {
    axisTitleHeight?: number;
    axisWidth: number;
    gapBetweenAxisLabelAndBorder?: number;
    gapBetweenTickAndTickLabel?: number;
    labelAngle?: number;
    tickSize?: number;
    tickTextStyle?: CSSProperties;
  }): AxisLayout {
    const tickLabels = this.getTickLabels();

    const tickLabelDimensions = tickLabels.map((text: string) =>
      getTextDimension({
        style: tickTextStyle,
        text,
      }),
    );

    const { labelOverlap, labelPadding, orient } = this.config;

    const maxWidth = Math.max(...tickLabelDimensions.map(d => d.width), 0);

    // TODO: Add other strategies: stagger, chop, wrap.
    let strategyForLabelOverlap = labelOverlap;
    if (strategyForLabelOverlap === 'auto') {
      // cheap heuristic, can improve
      const widthPerTick = axisWidth / tickLabels.length;
      if (this.channelEncoder.isY() || maxWidth <= widthPerTick) {
        strategyForLabelOverlap = 'flat';
      } else {
        strategyForLabelOverlap = 'rotate';
      }
    }

    const spaceForAxisTitle = this.hasTitle() ? labelPadding + axisTitleHeight : 0;
    let tickTextAnchor;
    let labelOffset: number = 0;
    let requiredMargin =
      tickSize + gapBetweenTickAndTickLabel + spaceForAxisTitle + gapBetweenAxisLabelAndBorder;

    if (this.channelEncoder.isX()) {
      if (strategyForLabelOverlap === 'flat') {
        const labelHeight = tickLabelDimensions.length > 0 ? tickLabelDimensions[0].height : 0;
        labelOffset = labelHeight + labelPadding;
        requiredMargin += labelHeight;
      } else if (strategyForLabelOverlap === 'rotate') {
        const labelHeight = Math.ceil(Math.abs(maxWidth * Math.sin((labelAngle * Math.PI) / 180)));
        labelOffset = labelHeight + labelPadding;
        requiredMargin += labelHeight;
        tickTextAnchor =
          (orient === 'top' && labelAngle > 0) || (orient === 'bottom' && labelAngle < 0)
            ? 'end'
            : 'start';
      }
      requiredMargin += 8;
    } else {
      labelOffset = maxWidth + spaceForAxisTitle;
      requiredMargin += maxWidth;
    }

    return {
      axisWidth,
      labelAngle: strategyForLabelOverlap === 'flat' ? 0 : labelAngle,
      labelFlush:
        typeof this.config.labelFlush === 'undefined'
          ? // If not set, only enable flushing for continuous scales
            this.channelEncoder.scale!.scaleTypeCategory === 'continuous'
          : this.config.labelFlush,
      labelOffset,
      labelOverlap: strategyForLabelOverlap,
      minMargin: {
        [orient]: Math.ceil(requiredMargin),
      },
      orient,
      tickLabelDimensions,
      tickLabels,
      tickTextAnchor,
    };
  }
}
