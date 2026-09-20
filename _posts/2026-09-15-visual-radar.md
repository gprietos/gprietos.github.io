---
title: "Visual Radar"
date: 2026-09-15
categories: [Practical Projects]
tags: [Practical, Visual Radar]
description: "Fusing real-time object detection, monocular depth estimation and inertial data to turn a single camera feed into a low-cost situational-awareness radar."
---

# Introduction

## AÑA

### AÑAAAA
### AÑAÑO

## ÑE

**Situational awareness** is the ability to understand an environment by perceiving its present elements,  comprehending their behaviour and predicting their near future status. It is a foundamental requirement for modern ground operation and automous vehicles and robotics, as these systems need to know precisely what surrounds them and where those target objects are relative to their own position at any given moment.

In practice, situational awareness is commonly achieved through a combination of complementary sensors, each providing different information about the surrounding environment.

[LiDAR](https://en.wikipedia.org/wiki/Lidar) sensors provide accurate metric distances and detailed 3D representations of the environment, but they can get expensive, especially for hobbyist projects. They can also be relatively fragile and complex, and their performance can be affected by certain environmental conditions. [Radar](https://en.wikipedia.org/wiki/Radar) offers long-range detection and is relatively resilient to adverse weather conditions such as fog or smoke. However, it generally struggles more with target identification, as conventional radar provides less spatial and semantic detail than LiDAR or cameras.

Both LiDAR and radar are **active sensors**, meaning that they emit energy into the environment. This can be a significant drawback in applications where low observability is important, such as military or stealth operations. For example, LiDAR emits laser light that may be detectable by night-vision or optical systems, potentially revealing the presence or position of the platform.

**Cameras** on the other hand are **passive sensors**, meaning that they receive energy from the environment instead of emiting it. They are also more accesible; they are cheaper, smaller and less power-hungry (after all, nearly everyone carries one around in their smartphone these days). RGB cameras excel at capturing rich, dense and detailed visual information. Thermal cameras can be used to overcome lighting limitations, capturing radiation from the infrared spectrum rather than visible light. Nevertheless, conventional cameras project the three-dimensional world into two-dimensional image, losing depth information. Specialized hardware like stereo cameras attempts to solve this, but its effective range is still limited.

Fortunately, moden **Deep Learning** advancements applied to **Computer Vision** help to close the gap without relying on expensive hardware. **Object Detection** networks identify what is in a frame and where it sits on a 2D image plane. **Monocular Depth Estimation** netoworks predict pixel-level depth maps, which can be used to effectively recovering the 3D geometry that standard cameras lack.

That realization inspired me to build the **Visual Radar** system. By pairing real-time object detection with monocular depth estimation, the system infers the spatial positions of surrounding targets from a standard video feed. Fusing this visual intelligence with inertial measurements makes it possible to map those targets directly onto a dynamic, top-down bird's-eye view radar plot.

The goal of the Visual Radar pipeline is to generate a real-time tactical map solely from monocular image and inertial data, providing situational awareness without the high cost or operational drawbacks of specialized sensors.

<div class="right" style="width: 40%;" markdown="1">
{% include embed/video.html src='/assets/videos/visual_radar/PinholeCameraModel.mp4' title='Pinhole camera model' %}
</div>

BLOCK OF TEXT BLOCK OF TEXT BLOCK OF TEXT BLOCK OF TEXT BLOCK OF TEXT BLOCK OF TEXT BLOCK OF TEXT BLOCK OF TEXT BLOCK OF TEXT BLOCK OF TEXT BLOCK OF TEXT BLOCK OF TEXT BLOCK OF TEXT BLOCK OF TEXT BLOCK OF TEXT BLOCK OF TEXT BLOCK OF TEXT BLOCK OF TEXT BLOCK OF TEXT 