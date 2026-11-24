package com.healthmate.model;

import java.util.ArrayList;
import java.util.List;

/**
 * Represents a user's saved theme preference and reminder notification schedule.
 */
public class UserSettings {

    private String themeMode;
    private boolean waterEnabled;
    private String waterTime1;
    private String waterTime2;
    private String waterTime3;
    private boolean dailyEnabled;
    private String dailyTime;
    private List<String> scheduledIds;

    public UserSettings() {
        this.themeMode = "system";
        this.waterEnabled = false;
        this.waterTime1 = "09:00";
        this.waterTime2 = "13:00";
        this.waterTime3 = "17:00";
        this.dailyEnabled = false;
        this.dailyTime = "20:30";
        this.scheduledIds = new ArrayList<>();
    }

    public String getThemeMode() {
        return themeMode;
    }

    public void setThemeMode(String themeMode) {
        this.themeMode = themeMode;
    }

    public boolean isWaterEnabled() {
        return waterEnabled;
    }

    public void setWaterEnabled(boolean waterEnabled) {
        this.waterEnabled = waterEnabled;
    }

    public String getWaterTime1() {
        return waterTime1;
    }

    public void setWaterTime1(String waterTime1) {
        this.waterTime1 = waterTime1;
    }

    public String getWaterTime2() {
        return waterTime2;
    }

    public void setWaterTime2(String waterTime2) {
        this.waterTime2 = waterTime2;
    }

    public String getWaterTime3() {
        return waterTime3;
    }

    public void setWaterTime3(String waterTime3) {
        this.waterTime3 = waterTime3;
    }

    public boolean isDailyEnabled() {
        return dailyEnabled;
    }

    public void setDailyEnabled(boolean dailyEnabled) {
        this.dailyEnabled = dailyEnabled;
    }

    public String getDailyTime() {
        return dailyTime;
    }

    public void setDailyTime(String dailyTime) {
        this.dailyTime = dailyTime;
    }

    public List<String> getScheduledIds() {
        return scheduledIds;
    }

    public void setScheduledIds(List<String> scheduledIds) {
        this.scheduledIds = scheduledIds;
    }
}

