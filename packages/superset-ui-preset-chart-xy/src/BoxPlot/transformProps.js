/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
/* eslint-disable sort-keys, no-magic-numbers */
import { getNumberFormatter } from '@superset-ui/number-format';

export default function transformProps(chartProps) {
  const { width, height, formData, payload } = chartProps;
  const { encoding } = formData;

  const data = payload.data.map(({ label, values }) => ({
    label,
    min: values.whisker_low,
    max: values.whisker_high,
    firstQuartile: values.Q1,
    median: values.Q2,
    thirdQuartile: values.Q3,
    outliers: values.outliers,
  }));

  const boxPlotValues = data.reduce((r, e) => r.push(e.min, e.max, ...e.outliers) && r, []);
  const minBoxPlotValue = Math.min(...boxPlotValues);
  const maxBoxPlotValue = Math.max(...boxPlotValues);
  const valueDomain = [
    minBoxPlotValue - 0.1 * Math.abs(minBoxPlotValue),
    maxBoxPlotValue + 0.1 * Math.abs(maxBoxPlotValue),
  ];

  // hack
  encoding.y.axis.tickFormat = getNumberFormatter();
  encoding.y.scale.domain = valueDomain;

  return {
    data,
    width,
    height,
    // margin,
    // theme,
    encoding,
  };
}
